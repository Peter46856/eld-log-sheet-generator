# eld_backend/trips/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TripViewSet

router = DefaultRouter()
router.register(r'trips', TripViewSet) # This creates /trips/ and /trips/{id}/ endpoints

urlpatterns = [
    path('', include(router.urls)),
]