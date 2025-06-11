# eld_backend/trips/views.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from .models import Trip, LogEntry, DutyStatus
from .serializers import TripSerializer, LogEntrySerializer
from datetime import datetime, timedelta, date
import requests
import json
import os
from django.conf import settings # Import settings
from django.utils import timezone # Import timezone

# --- Constants for HOS (Hours of Service) Rules ---
# These should ideally be configurable or come from a rules engine
MAX_DRIVING_HOURS_DAY = 11
MAX_ON_DUTY_HOURS_DAY = 14
MAX_ON_DUTY_HOURS_CYCLE = 70 # For 8-day cycle
CYCLE_DAYS = 8
MIN_OFF_DUTY_HOURS = 10 # Minimum off-duty between shifts
MIN_BREAK_HOURS = 0.5 # 30-minute break after 8 hours driving
PICKUP_DROPOFF_HOURS = 1 # 1 hour for pickup and 1 hour for drop-off
FUELING_INTERVAL_KM = 1000 # Fueling at least once every 1,000 miles (converted to KM)
FUELING_DURATION_HOURS = 0.5 # Duration for a fueling stop

# Add this helper function to handle naive datetimes
def get_aware_datetime(naive_dt):
    if timezone.is_aware(naive_dt):
        return naive_dt
    # Assume local timezone if not specified. Adjust if you have a specific TZ.
    return timezone.make_aware(naive_dt, timezone.get_current_timezone())

class TripViewSet(viewsets.ModelViewSet):
    queryset = Trip.objects.all().order_by('-created_at')
    serializer_class = TripSerializer

    @action(detail=True, methods=['post'])
    def calculate_route_and_logs(self, request, pk=None):
        trip = self.get_object()

        # Initialize current_time here, before it's used in route_info population
        start_date = timezone.localdate()
        current_time = get_aware_datetime(datetime.combine(start_date, datetime.min.time()))

        # Retrieve API key from settings
        ORS_API_KEY = settings.ORS_API_KEY

        # --- 1. Route Calculation (OpenRouteService Integration) ---
        base_url = "https://api.openrouteservice.org"

        # Step 1.1: Geocoding (Convert locations to coordinates)
        # Using the ORS Geocoding API (Pelias)
        def geocode_location(location_name):
            if not location_name:
                print("Location name is empty.")
                return None
            geocode_url = f"{base_url}/geocode/search"
            headers = {
                "Accept": "application/json, application/geo+json, application/gpx+xml, application/xml, text/xml, */*",
                "Authorization": ORS_API_KEY
            }
            params = {
                "api_key": ORS_API_KEY, # Sometimes also needed in params for ORS
                "text": location_name,
                "size": 1 # Get the top result
            }
            try:
                print(f"Attempting to geocode: '{location_name}'")
                response = requests.get(geocode_url, headers=headers, params=params, timeout=10) # Added timeout
                response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
                data = response.json()
                if data and data['features']:
                    # Coordinates are typically [longitude, latitude] in GeoJSON
                    coords = data['features'][0]['geometry']['coordinates']
                    print(f"Geocoded '{location_name}' to {coords}")
                    return coords # [longitude, latitude]
                else:
                    print(f"No geocoding results found for '{location_name}'.")
                    return None
            except requests.exceptions.RequestException as e:
                print(f"Geocoding error for '{location_name}': {e}")
                return None

        pickup_coords = geocode_location(trip.pickup_location)
        dropoff_coords = geocode_location(trip.dropoff_location)
        # Assuming trip.current_location is the starting point for the route calculation
        # If not, you might need to use `pickup_coords` as the first point.
        current_coords = geocode_location(trip.current_location)

        route_info = {} # Initialize route_info

        # Storing geocoded coordinates for pickup and dropoff to use in stops_and_rests
        pickup_lat, pickup_lon = (pickup_coords[1], pickup_coords[0]) if pickup_coords else (None, None)
        dropoff_lat, dropoff_lon = (dropoff_coords[1], dropoff_coords[0]) if dropoff_coords else (None, None)

        if not (pickup_coords and dropoff_coords and current_coords):
            # Fallback to simulated data if geocoding fails for any required location
            print("Geocoding failed for one or more locations (current, pickup, or dropoff). Falling back to simulated route data.")
            simulated_route_info = {
                "path_coordinates": [
                    [-1.286389, 36.817223], # Nairobi (lon, lat)
                    [-0.091702, 34.767936], # Kisumu (lon, lat)
                    [-4.043740, 39.668205]  # Mombasa (lon, lat)
                ],
                "total_distance_km": 1000, # Example total distance
                "total_duration_hours_driving": 15, # Example total driving hours
                "estimated_stops_and_rests": [
                    {"type": "rest", "location": "Somewhere along the route", "duration_hrs": 2, "latitude": -0.091702, "longitude": 34.767936}, # Example coords for rest
                    {"type": "fuel", "location": "Mid-way point", "duration_hrs": 0.5, "latitude": -0.091702, "longitude": 34.767936} # Example coords for fuel
                ]
            }
            route_info = simulated_route_info
        else:
            # Step 1.2: Routing (Calculate route using ORS Directions API)
            # Coordinates for ORS are [longitude, latitude]
            coordinates = [current_coords, pickup_coords, dropoff_coords]

            # Use 'driving-hgv' profile for heavy goods vehicles as per requirements
            directions_url = f"{base_url}/v2/directions/driving-hgv/geojson" # Changed to driving-hgv
            headers = {
                "Accept": "application/json, application/geo+json, application/gpx+xml, application/xml, text/xml, */*",
                "Authorization": ORS_API_KEY,
                "Content-Type": "application/json; charset=utf-8"
            }
            body = {
                "coordinates": coordinates,
                "units": "km",
                "language": "en-US",
                "radiuses": [-1] * len(coordinates) # Search for coordinates within unlimited radius
            }

            try:
                print(f"Requesting route for coordinates: {coordinates}")
                response = requests.post(directions_url, headers=headers, data=json.dumps(body), timeout=30) # Increased timeout for routing
                response.raise_for_status()
                data = response.json()

                if data and data['features']:
                    route_geometry = data['features'][0]['geometry']['coordinates'] # Route path coordinates (lon, lat)
                    summary = data['features'][0]['properties']['summary']
                    total_distance_km = summary['distance'] / 1000 # Convert meters to km
                    total_duration_seconds = summary['duration'] # Duration in seconds
                    total_duration_hours_driving = total_duration_seconds / 3600

                    # Dynamically calculate estimated stops and rests based on route and HOS
                    dynamic_stops_and_rests = []

                    # Add pickup/dropoff times with their coordinates
                    dynamic_stops_and_rests.append({
                        "type": "pickup",
                        "location": trip.pickup_location,
                        "duration_hrs": PICKUP_DROPOFF_HOURS,
                        "time": current_time.isoformat(), # Use current_time as start of pickup
                        "latitude": pickup_lat,
                        "longitude": pickup_lon
                    })
                    # Add dropoff time, assuming it's at the end of the calculated route
                    # You might want to assign a more precise time later in the HOS logic
                    dynamic_stops_and_rests.append({
                        "type": "dropoff",
                        "location": trip.dropoff_location,
                        "duration_hrs": PICKUP_DROPOFF_HOURS,
                        "time": (current_time + timedelta(hours=total_duration_hours_driving)).isoformat(), # Approximate time
                        "latitude": dropoff_lat,
                        "longitude": dropoff_lon
                    })

                    # Add fueling stops every 1000 km
                    for i in range(1, int(total_distance_km // FUELING_INTERVAL_KM) + 1):
                        approx_location = f"Route Km {i * FUELING_INTERVAL_KM}" # More precise location would require interpolating path_coordinates
                        # For now, just use pickup_coords as a placeholder for fuel stops, or find a point along the route
                        # A more advanced implementation would interpolate coordinates along route_geometry
                        dynamic_stops_and_rests.append({
                            "type": "fuel",
                            "location": approx_location,
                            "duration_hrs": FUELING_DURATION_HOURS,
                            "latitude": pickup_lat, # Using pickup_lat/lon as a placeholder
                            "longitude": pickup_lon  # Using pickup_lat/lon as a placeholder
                        })
                    
                    # Sort stops by approximate occurrence (e.g., distance or time) for better representation
                    # This is simplified; a full implementation would integrate them into the route segments.
                    # For now, just order the list.

                    route_info = {
                        "path_coordinates": route_geometry, # This is [lon, lat]
                        "total_distance_km": total_distance_km,
                        "total_duration_hours_driving": total_duration_hours_driving,
                        "estimated_stops_and_rests": dynamic_stops_and_rests # Populated dynamically with coordinates
                    }
                    print("Route calculated successfully from OpenRouteService.")
                else:
                    print("No routing results found from OpenRouteService. Falling back to simulated data.")
                    # Fallback if ORS fails or returns no features
                    route_info = {
                        "path_coordinates": [
                            [-1.286389, 36.817223], # Nairobi (lon, lat)
                            [-0.091702, 34.767936], # Kisumu (lon, lat)
                            [-4.043740, 39.668205]  # Mombasa (lon, lat)
                        ],
                        "total_distance_km": 1000,
                        "total_duration_hours_driving": 15,
                        "estimated_stops_and_rests": [
                            {"type": "rest", "location": "Somewhere along the route", "duration_hrs": 2, "latitude": -0.091702, "longitude": 34.767936},
                            {"type": "fuel", "location": "Mid-way point", "duration_hrs": 0.5, "latitude": -0.091702, "longitude": 34.767936}
                        ]
                    }

            except requests.exceptions.RequestException as e:
                print(f"Routing error with OpenRouteService: {e}. Falling back to simulated data.")
                # Fallback on error
                route_info = {
                    "path_coordinates": [
                        [-1.286389, 36.817223], # Nairobi (lon, lat)
                        [-0.091702, 34.767936], # Kisumu (lon, lat)
                        [-4.043740, 39.668205]  # Mombasa (lon, lat)
                    ],
                    "total_distance_km": 1000,
                    "total_duration_hours_driving": 15,
                    "estimated_stops_and_rests": [
                        {"type": "rest", "location": "Somewhere along the route", "duration_hrs": 2, "latitude": -0.091702, "longitude": 34.767936},
                        {"type": "fuel", "location": "Mid-way point", "duration_hrs": 0.5, "latitude": -0.091702, "longitude": 34.767936}
                    ]
                }

        # --- 2. ELD Log Generation (HOS Logic) ---
        # Now, the HOS logic will use the 'total_distance_km' and 'total_duration_hours_driving'
        # from the 'route_info' which is populated either by ORS or the fallback simulated data.

        total_trip_distance_km = route_info["total_distance_km"]
        total_driving_hours_needed = route_info["total_duration_hours_driving"]
        # estimated_stops_and_rests is now generated dynamically in route_info section

        # total_non_driving_on_duty_hours calculation needs to be more precise
        # if using the dynamically generated stops and rests.
        # For this simplified HOS logic, we'll iterate through the total driving time
        # and enforce breaks. Pickup/dropoff will be handled at the start/end.
        # total_non_driving_on_duty_hours = sum(stop["duration_hrs"] for stop in estimated_stops_and_rests) # This line now needs adjustment

        # Delete existing logs for this trip before regenerating
        trip.log_entries.all().delete()

        # Initialize current time and date for logging
        # current_time is already initialized at the start of the method.
        # start_date = timezone.localdate() # This is now redundant
        # current_time = get_aware_datetime(datetime.combine(start_date, datetime.min.time())) # This is now redundant

        driving_hours_this_trip = 0.0
        on_duty_hours_today = 0.0
        on_duty_hours_cycle = trip.current_cycle_used # Initialize with current cycle used hours from trip
        
        log_entries_to_create = [] # Batch creation for efficiency
        dynamic_calculated_stops_and_rests = [] # To capture actual breaks and stops from HOS logic

        current_date = start_date # Initialize current_date

        # Add initial OFF_DUTY segment until start of "work day"
        initial_off_duty_end = current_time + timedelta(hours=8) # Start work after 8 hours off
        log_entries_to_create.append({
            'trip': trip,
            'log_date': current_time.date(),
            'start_time': current_time,
            'end_time': initial_off_duty_end,
            'status': DutyStatus.OFF_DUTY
        })
        current_time = initial_off_duty_end

        # Add initial pickup time
        pickup_start_time = current_time
        pickup_end_time = current_time + timedelta(hours=PICKUP_DROPOFF_HOURS)
        log_entries_to_create.append({
            'trip': trip,
            'log_date': pickup_start_time.date(),
            'start_time': pickup_start_time,
            'end_time': pickup_end_time,
            'status': DutyStatus.ON_DUTY_NOT_DRIVING
        })
        dynamic_calculated_stops_and_rests.append({
            "type": "pickup",
            "location": trip.pickup_location,
            "duration_hrs": PICKUP_DROPOFF_HOURS,
            "time": pickup_start_time.isoformat(),
            "latitude": pickup_lat, # Include geocoded latitude
            "longitude": pickup_lon # Include geocoded longitude
        })
        on_duty_hours_today += PICKUP_DROPOFF_HOURS
        on_duty_hours_cycle += PICKUP_DROPOFF_HOURS
        current_time = pickup_end_time

        next_fuel_stop_km = FUELING_INTERVAL_KM # Track next fueling point

        while driving_hours_this_trip < total_driving_hours_needed:
            # Check 70-hour/8-day rule
            if on_duty_hours_cycle >= MAX_ON_DUTY_HOURS_CYCLE:
                print(f"Cycle limit reached on {current_date}. Cannot drive more.")
                break # Driver is out of hours for the cycle

            # Move to next day if current time is past end of day or if no driving occurred
            if current_time.date() != current_date:
                # Add OFF_DUTY for remainder of previous day if necessary
                last_log_end = log_entries_to_create[-1]['end_time'] if log_entries_to_create else current_time
                end_of_prev_day = get_aware_datetime(datetime.combine(current_date, datetime.max.time()))
                if last_log_end < end_of_prev_day:
                    log_entries_to_create.append({
                        'trip': trip,
                        'log_date': current_date,
                        'start_time': last_log_end,
                        'end_time': end_of_prev_day,
                        'status': DutyStatus.OFF_DUTY
                    })
                
                current_date = current_time.date() # Update current_date for the loop
                on_duty_hours_today = 0.0 # Reset for new day

                # Ensure 10 hours off duty before next driving shift starts
                required_off_duty_until = get_aware_datetime(datetime.combine(current_time.date(), datetime.min.time())) + timedelta(hours=MIN_OFF_DUTY_HOURS)
                if current_time < required_off_duty_until:
                    off_duty_start = current_time
                    off_duty_end = required_off_duty_until
                    log_entries_to_create.append({
                        'trip': trip,
                        'log_date': off_duty_start.date(),
                        'start_time': off_duty_start,
                        'end_time': off_duty_end,
                        'status': DutyStatus.OFF_DUTY
                    })
                    current_time = off_duty_end


            # Calculate available driving hours for this segment
            drive_duration_hours = min(
                total_driving_hours_needed - driving_hours_this_trip, # Remaining trip driving
                MAX_DRIVING_HOURS_DAY - (on_duty_hours_today if current_time.date() == start_date else 0), # Simplified 11-hour rule for day
                MAX_ON_DUTY_HOURS_DAY - on_duty_hours_today, # 14-hour rule
                MAX_ON_DUTY_HOURS_CYCLE - on_duty_hours_cycle # 70-hour rule
            )

            # Ensure 30-minute break if driving more than 8 consecutive hours (simplified)
            # This is a basic implementation. Real HOS is more complex for break placement.
            if driving_hours_this_trip > 0 and (on_duty_hours_today > 8 and on_duty_hours_today - drive_duration_hours <= 8):
                break_start = current_time
                break_end = break_start + timedelta(hours=MIN_BREAK_HOURS)
                log_entries_to_create.append({
                    'trip': trip,
                    'log_date': break_start.date(),
                    'start_time': break_start,
                    'end_time': break_end,
                    'status': DutyStatus.OFF_DUTY # Break is off-duty
                })
                # Add placeholder coordinates for rest stops
                dynamic_calculated_stops_and_rests.append({
                    "type": "rest",
                    "location": f"Break on {break_start.date()}",
                    "duration_hrs": MIN_BREAK_HOURS,
                    "time": break_start.isoformat(),
                    "latitude": pickup_lat, # Using pickup_lat/lon as a placeholder
                    "longitude": pickup_lon # Using pickup_lat/lon as a placeholder
                })
                current_time = break_end
                on_duty_hours_today += MIN_BREAK_HOURS # Breaks contribute to 14-hour window
                on_duty_hours_cycle += MIN_BREAK_HOURS


            if drive_duration_hours > 0:
                drive_end_time = current_time + timedelta(hours=drive_duration_hours)

                # Cap driving at end of 14-hour window if it crosses it
                fourteen_hour_mark = get_aware_datetime(datetime.combine(current_time.date(), datetime.min.time())) + timedelta(hours=MAX_ON_DUTY_HOURS_DAY)
                if drive_end_time > fourteen_hour_mark:
                    drive_duration_hours = (fourteen_hour_mark - current_time).total_seconds() / 3600
                    drive_end_time = fourteen_hour_mark
                    if drive_duration_hours <= 0: # If no driving time left in 14-hr window
                        drive_duration_hours = 0
                        print(f"14-hour window closed on {current_date}. Forcing off-duty.")

                if drive_duration_hours > 0:
                    log_entries_to_create.append({
                        'trip': trip,
                        'log_date': current_time.date(),
                        'start_time': current_time,
                        'end_time': drive_end_time,
                        'status': DutyStatus.DRIVING
                    })
                    driving_hours_this_trip += drive_duration_hours
                    on_duty_hours_today += drive_duration_hours
                    on_duty_hours_cycle += drive_duration_hours
                    current_time = drive_end_time
                else:
                    # If no driving possible, move to off-duty or next day
                    pass # Handled by the off-duty logic below

            # If driving finished, or hit limits, go off-duty until the next day or new shift
            if driving_hours_this_trip < total_driving_hours_needed:
                # Add OFF_DUTY for remaining time in current day
                if current_time.date() == current_date and current_time.hour < 23:
                    off_duty_start = current_time
                    off_duty_end = get_aware_datetime(datetime.combine(current_time.date(), datetime.max.time())) # End of day
                    if off_duty_end > off_duty_start: # Ensure segment has duration
                        log_entries_to_create.append({
                            'trip': trip,
                            'log_date': off_duty_start.date(),
                            'start_time': off_duty_start,
                            'end_time': off_duty_end,
                            'status': DutyStatus.OFF_DUTY
                        })
                    current_time = off_duty_end + timedelta(seconds=1) # Move to start of next day


        # Add final dropoff time (if not already handled by initial pickup/dropoff logic)
        # This simplified HOS model applies total pickup/dropoff time at start.
        # For a more granular ELD, this would be determined by remaining `total_non_driving_on_duty_hours`
        # and added at the end of the trip or at the dropoff point.
        # For now, it's already included in dynamic_calculated_stops_and_rests.

        # Ensure a final off-duty segment until end of the last day logged
        if log_entries_to_create:
            last_entry_end_time = log_entries_to_create[-1]['end_time']
            end_of_last_logged_day = get_aware_datetime(datetime.combine(last_entry_end_time.date(), datetime.max.time()))
            if last_entry_end_time < end_of_last_logged_day:
                log_entries_to_create.append({
                    'trip': trip,
                    'log_date': last_entry_end_time.date(),
                    'start_time': last_entry_end_time,
                    'end_time': end_of_last_logged_day,
                    'status': DutyStatus.OFF_DUTY
                })

        # Create all log entries in bulk
        LogEntry.objects.bulk_create([
            LogEntry(
                trip=entry['trip'],
                log_date=entry['log_date'],
                start_time=entry['start_time'],
                end_time=entry['end_time'],
                status=entry['status']
            ) for entry in log_entries_to_create
        ])

        print(f"Generated {len(log_entries_to_create)} log entries.")

        # After generating, re-fetch the trip to include the new log entries in the response
        trip.refresh_from_db()
        serializer = self.get_serializer(trip)

        # Merge dynamically calculated stops from HOS with initial ORS-derived stops
        # Ensure unique stops or add logic for detailed merging if necessary.
        # For simplicity, I'm replacing the `estimated_stops_and_rests` with the combined list.
        # Note: This is a simplified merge, full ELD systems have more complex stop/event recording.
        combined_stops = route_info.get("estimated_stops_and_rests", []) + dynamic_calculated_stops_and_rests
        # Remove duplicates or overlapping entries if necessary after merging
        unique_stops = []
        seen_times_locations = set()
        for stop in combined_stops:
            # Create a tuple of relevant identifying info to check for uniqueness
            unique_key = (stop.get("time"), stop.get("location"), stop.get("type"))
            if unique_key not in seen_times_locations:
                unique_stops.append(stop)
                seen_times_locations.add(unique_key)
        # Sort stops by time for better chronological display
        unique_stops.sort(key=lambda x: x.get("time", ""))
        route_info["estimated_stops_and_rests"] = unique_stops


        return Response({
            "message": "Route and ELD logs calculated successfully using OpenRouteService.",
            "route_info": {
                "path_coordinates": route_info.get("path_coordinates", []),
                "total_distance_km": route_info.get("total_distance_km", 0),
                "total_duration_hours_driving": route_info.get("total_duration_hours_driving", 0),
                "estimated_stops_and_rests": route_info.get("estimated_stops_and_rests", [])
            },
            "trip_details": serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def logs(self, request, pk=None):
        """
        Returns all log entries for a specific trip, grouped by date.
        """
        trip = self.get_object()
        log_entries = trip.log_entries.all().order_by('log_date', 'start_time')

        # Group log entries by date for easier frontend rendering
        logs_by_date = {}
        for entry in log_entries:
            date_str = entry.log_date.isoformat()
            if date_str not in logs_by_date:
                logs_by_date[date_str] = []
            logs_by_date[date_str].append(LogEntrySerializer(entry).data)

        return Response(logs_by_date, status=status.HTTP_200_OK)