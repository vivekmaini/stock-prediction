from rest_framework.views import APIView
from .serializer import StockPrediction
from rest_framework import status
from rest_framework.response import Response
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime
import os
from django.conf import settings
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error, r2_score
from tensorflow.keras.models import load_model


class StockPredictionAPIView(APIView):
    def post(self, request):
        serializer = StockPrediction(data=request.data)

        if serializer.is_valid():
            ticker = serializer.validated_data['ticker']

            # ================= FETCH DATA =================
            now = datetime.now()
            start = datetime(now.year - 10, now.month, now.day)

            df = yf.download(ticker, start, now)

            if df.empty:
                return Response({
                    "error": "No data found for the given ticker."
                }, status=status.HTTP_404_NOT_FOUND)

            # IMPORTANT FIX
            df = df[['Close']].dropna()
            df.index = pd.to_datetime(df.index)

            # ================= MOVING AVERAGES =================
            df['MA50'] = df['Close'].rolling(50).mean()
            df['MA100'] = df['Close'].rolling(100).mean()
            df['MA200'] = df['Close'].rolling(200).mean()

            # fill missing values
            df = df.bfill()

            # ================= SIGNAL LOGIC =================
            latest_close = float(df['Close'].iloc[-1])
            latest_ma50 = float(df['MA50'].iloc[-1])
            latest_ma100 = float(df['MA100'].iloc[-1])

            signal = "HOLD"
            if latest_close > latest_ma50 and latest_ma50 > latest_ma100:
                signal = "BUY"
            elif latest_close < latest_ma50 and latest_ma50 < latest_ma100:
                signal = "SELL"

            # ================= PRICE ANALYSIS =================
            current_price = latest_close

            old_price = float(df['Close'].iloc[-100]) if len(df) >= 100 else float(df['Close'].iloc[0])

            price_change = current_price - old_price
            percentage_change = (price_change / old_price) * 100

            # ================= TRAIN / TEST =================
            data_training = pd.DataFrame(df['Close'][:int(len(df)*0.7)])
            data_testing = pd.DataFrame(df['Close'][int(len(df)*0.7):])

            scaler = MinMaxScaler(feature_range=(0, 1))
            scaler.fit(data_training.values.reshape(-1, 1))

            past_100_days = data_training.tail(100)
            final_df = pd.concat([past_100_days, data_testing], ignore_index=True)

            input_data = scaler.transform(final_df.values.reshape(-1, 1))

            x_test, y_test = [], []

            for i in range(100, input_data.shape[0]):
                x_test.append(input_data[i-100:i])
                y_test.append(input_data[i, 0])

            x_test, y_test = np.array(x_test), np.array(y_test)

            # ================= LOAD MODEL =================
            model_path = os.path.join(
                settings.BASE_DIR,
                "models",
                "stock_prediction_portal.keras"
            )

            if not os.path.exists(model_path):
                return Response({
                    "error": "Model file not found."
                }, status=500)

            model = load_model(model_path)

            # ================= PREDICTION =================
            y_predicted = model.predict(x_test)

            y_predicted = scaler.inverse_transform(
                y_predicted.reshape(-1, 1)
            ).flatten()

            y_test = scaler.inverse_transform(
                y_test.reshape(-1, 1)
            ).flatten()

            # ================= PREPARE CHART DATA =================
            history_df = df.tail(500).copy().reset_index()

            pred_df = pd.DataFrame({
                "Actual": y_test,
                "Predicted": y_predicted
            })

            # SIGNAL VALUES (SAFE)
            signal_values = []

            for i in range(len(history_df)):
                c = float(history_df['Close'].iloc[i])
                ma100 = float(history_df['MA100'].iloc[i])
                ma200 = float(history_df['MA200'].iloc[i])

                if c > ma100 and ma100 > ma200:
                    signal_values.append(1)
                elif c < ma100 and ma100 < ma200:
                    signal_values.append(-1)
                else:
                    signal_values.append(0)

            # ================= METRICS =================
            mse = mean_squared_error(y_test, y_predicted)
            rmse = np.sqrt(mse)
            r2 = r2_score(y_test, y_predicted)

            # ================= FINAL RESPONSE =================
            return Response({
                'status': 'success',

                # PRICE + SIGNAL
                'signal': signal,
                'current_price': current_price,
                'old_price': old_price,
                'price_change': price_change,
                'percentage_change': percentage_change,

                # MODEL
                'mse': mse,
                'rmse': rmse,
                'r2': r2,

                # 🔥 CHART DATA (FINAL FIXED)
                "history_dates": history_df["Date"].astype(str).tolist(),
                "close_prices": history_df["Close"].astype(float).fillna(0).values.tolist(),
                "ma100": history_df["MA100"].astype(float).fillna(0).values.tolist(),
                "ma200": history_df["MA200"].astype(float).fillna(0).values.tolist(),

                "pred_dates": list(range(len(pred_df))),
                "actual_prices": pred_df["Actual"].astype(float).values.tolist(),
                "pred_prices": pred_df["Predicted"].astype(float).values.tolist(),

                "signal_dates": history_df["Date"].astype(str).tolist(),
                "signal_values": signal_values
            })

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)