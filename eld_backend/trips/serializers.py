# eld_backend/trips/serializers.py
from rest_framework import serializers
from .models import Trip, LogEntry, DutyStatus

class LogEntrySerializer(serializers.ModelSerializer):
    # This will display the human-readable choice in the API output
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = LogEntry
        fields = ['id', 'log_date', 'start_time', 'end_time', 'status', 'status_display']

class TripSerializer(serializers.ModelSerializer):
    # Nest LogEntrySerializer to include related log entries when fetching a trip
    log_entries = LogEntrySerializer(many=True, read_only=True)

    class Meta:
        model = Trip
        fields = ['id', 'current_location', 'pickup_location', 'dropoff_location', 'current_cycle_used', 'created_at', 'updated_at', 'log_entries']
        read_only_fields = ['created_at', 'updated_at'] # These are auto-managed