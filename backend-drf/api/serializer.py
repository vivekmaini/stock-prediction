from rest_framework import serializers


class StockPrediction(serializers.Serializer):
    ticker=serializers.CharField(max_length=20)