"""
# eld_backend/trips/models.py
from django.db import models

class Trip(models.Model):
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    # Using FloatField for hours, as it can be fractional (e.g., 5.5 hours)
    current_cycle_used_hrs = models.FloatField(help_text="Current Cycle Used (Hrs)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Trip from {self.pickup_location} to {self.dropoff_location}"

# Define choices for duty status (as per ELD log example)
class DutyStatus(models.TextChoices):
    OFF_DUTY = 'OFF_DUTY', '1. Off Duty (not driving)'
    SLEEPER_BERTH = 'SLEEPER_BERTH', '2. Sleeper Berth'
    DRIVING = 'DRIVING', '3. Driving'
    ON_DUTY_NOT_DRIVING = 'ON_DUTY_NOT_DRIVING', '4. On Duty (not driving)'

class LogEntry(models.Model):
    trip = models.ForeignKey(Trip, related_name='log_entries', on_delete=models.CASCADE)
    log_date = models.DateField()
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(
        max_length=50,
        choices=DutyStatus.choices,
        default=DutyStatus.OFF_DUTY,
    )
    # Could add remarks, mileage for future use, but keep it simple for now
    # remarks = models.TextField(blank=True, null=True)
    # miles_driven = models.FloatField(blank=True, null=True)

    class Meta:
        # Ensures that for a given trip and date, a time range isn't duplicated
        unique_together = ('trip', 'log_date', 'start_time', 'end_time')
        ordering = ['log_date', 'start_time']

    def __str__(self):
        return f"{self.trip} - {self.log_date}: {self.status} from {self.start_time.strftime('%H:%M')} to {self.end_time.strftime('%H:%M')}"

"""

# eld_backend/trips/models.py
from django.db import models

class Trip(models.Model):
    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    # Add the new field here
    current_cycle_used = models.FloatField(default=0.0) # Set a default value, e.g., 0.0 hours
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Trip from {self.current_location} to {self.dropoff_location}"

class DutyStatus(models.TextChoices):
    DRIVING = 'DRIVING', 'Driving'
    ON_DUTY_NOT_DRIVING = 'ON_DUTY_NOT_DRIVING', 'On-Duty (Not Driving)'
    OFF_DUTY = 'OFF_DUTY', 'Off-Duty'
    SLEEPER_BERTH = 'SLEEPER_BERTH', 'Sleeper Berth' # If you plan to implement sleeper berth rules

class LogEntry(models.Model):
    trip = models.ForeignKey(Trip, related_name='log_entries', on_delete=models.CASCADE)
    log_date = models.DateField()
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    status = models.CharField(max_length=50, choices=DutyStatus.choices)
    
    class Meta:
        ordering = ['start_time'] # Ensure logs are ordered correctly

    def __str__(self):
        return f"Log for Trip {self.trip.id} on {self.log_date}: {self.status} from {self.start_time.strftime('%H:%M')} to {self.end_time.strftime('%H:%M')}"