from django.urls import path
from accounts import views as Userview
from rest_framework_simplejwt.views import TokenObtainPairView,TokenRefreshView
from .views import StockPredictionAPIView



urlpatterns=[
    path('register/',Userview.Registerview.as_view()),

     path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    path('protected-view/',Userview.Protectedview.as_view()),

    #prediction api
    path('predict/',StockPredictionAPIView.as_view(),name='Stock_prediction'),
]