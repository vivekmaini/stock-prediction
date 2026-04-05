from django.shortcuts import render
from rest_framework import generics
from django.contrib.auth.models import User
from . serializers import accountserializer
from rest_framework.permissions import AllowAny,IsAuthenticated
from rest_framework.views import APIView
from rest_framework.response import Response

class Registerview(generics.CreateAPIView):
    queryset=User.objects.all()
    serializer_class=accountserializer
    permission_classes=[AllowAny]

class Protectedview(APIView):
  permission_classes=[IsAuthenticated]
  def get(self,request):
     response={
        'status':'Request is permitted'
     }
     return Response(response)