from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, date, time
from typing import List, Optional
import uuid

app = FastAPI(title="Kartide Broneerimissüsteem")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

class CardType(BaseModel):
    id: str
    name: str
    description: str
    price: float
    duration_minutes: int

class RideSlot(BaseModel):
    id: str
    card_type_id: str
    date: date
    start_time: time
    end_time: time
    total_capacity: int
    available_capacity: int

class CardSelection(BaseModel):
    card_type_id: str
    quantity: int

class Customer(BaseModel):
    id: str
    first_name: str
    last_name: str
    email: str
    phone: str

class Booking(BaseModel):
    id: str
    customer_id: str
    ride_slot_id: str
    card_selections: List[CardSelection]
    date: date
    start_time: time
    end_time: time
    status: str
    total_price: float
    notes: Optional[str] = None

class BookingRequest(BaseModel):
    customer_first_name: str
    customer_last_name: str
    customer_email: str
    customer_phone: str
    ride_slot_id: str
    card_selections: List[CardSelection]
    notes: Optional[str] = None

card_types_db = [
    CardType(id="1", name="Go-kart", description="Kiire go-kart sõit", price=15.0, duration_minutes=10),
    CardType(id="2", name="Elektrikart", description="Keskkonnasõbralik elektrikart", price=18.0, duration_minutes=10),
    CardType(id="3", name="Professionaalne kart", description="Võidusõidu kart kogenud sõitjatele", price=25.0, duration_minutes=15),
    CardType(id="4", name="Laste kart", description="Turvaline kart lastele", price=12.0, duration_minutes=8)
]

ride_slots_db = []
customers_db = []
bookings_db = []

from datetime import timedelta

class OpeningHours(BaseModel):
    weekday: int
    start_time: time
    end_time: time
    is_closed: bool = False

class Holiday(BaseModel):
    id: str
    date: date
    name: str
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_closed: bool = True

class BookingSettings(BaseModel):
    interval_minutes: int = 30
    max_booking_duration_minutes: int = 60
    advance_booking_days: int = 30
    max_cards_per_slot: int = 8

opening_hours_db = [
    OpeningHours(weekday=0, start_time=time(9, 0), end_time=time(17, 0)),  # Monday
    OpeningHours(weekday=1, start_time=time(9, 0), end_time=time(17, 0)),  # Tuesday
    OpeningHours(weekday=2, start_time=time(9, 0), end_time=time(17, 0)),  # Wednesday
    OpeningHours(weekday=3, start_time=time(9, 0), end_time=time(17, 0)),  # Thursday
    OpeningHours(weekday=4, start_time=time(9, 0), end_time=time(17, 0)),  # Friday
    OpeningHours(weekday=5, start_time=time(10, 0), end_time=time(16, 0), is_closed=True),  # Saturday - CLOSED
    OpeningHours(weekday=6, start_time=time(10, 0), end_time=time(16, 0), is_closed=False),  # Sunday - OPEN
]

holidays_db = []
booking_settings_db = BookingSettings()

def generate_ride_slots_dynamic():
    """Generate ride slots based on current opening hours, holidays, and booking settings"""
    slots = []
    start_date = date.today()
    
    for day_offset in range(booking_settings_db.advance_booking_days):
        current_date = start_date + timedelta(days=day_offset)
        weekday = current_date.weekday()
        
        opening_hours = next((h for h in opening_hours_db if h.weekday == weekday), None)
        if not opening_hours or opening_hours.is_closed:
            continue
            
        holiday = next((h for h in holidays_db if h.date == current_date), None)
        if holiday and holiday.is_closed:
            continue
            
        if holiday and not holiday.is_closed:
            day_start = holiday.start_time or opening_hours.start_time
            day_end = holiday.end_time or opening_hours.end_time
        else:
            day_start = opening_hours.start_time
            day_end = opening_hours.end_time
            
        current_time = datetime.combine(current_date, day_start)
        end_time = datetime.combine(current_date, day_end)
        interval_delta = timedelta(minutes=booking_settings_db.interval_minutes)
        
        while current_time < end_time:
            slot_start = current_time.time()
            slot_end_time = current_time + interval_delta
            
            if slot_end_time.time() > day_end:
                current_time += interval_delta
                continue
                
            slot = RideSlot(
                id=str(uuid.uuid4()),
                card_type_id="",
                date=current_date,
                start_time=slot_start,
                end_time=slot_end_time.time(),
                total_capacity=booking_settings_db.max_cards_per_slot,
                available_capacity=booking_settings_db.max_cards_per_slot
            )
            slots.append(slot)
                
            current_time += interval_delta
    
    return slots

ride_slots_db = []

def refresh_ride_slots():
    """Refresh ride slots based on current settings"""
    global ride_slots_db
    
    existing_bookings = {}
    for booking in bookings_db:
        key = (booking.date, booking.start_time)
        total_quantity = sum(selection.quantity for selection in booking.card_selections)
        if key in existing_bookings:
            existing_bookings[key] += total_quantity
        else:
            existing_bookings[key] = total_quantity
    
    new_slots = generate_ride_slots_dynamic()
    
    for slot in new_slots:
        key = (slot.date, slot.start_time)
        if key in existing_bookings:
            booked_count = existing_bookings[key]
            slot.available_capacity = max(0, slot.total_capacity - booked_count)
    
    ride_slots_db = new_slots

refresh_ride_slots()

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.get("/card-types", response_model=List[CardType])
async def get_card_types():
    return card_types_db

@app.get("/ride-slots")
async def get_available_ride_slots(card_type_id: Optional[str] = None, date_from: Optional[date] = None):
    slots = [slot for slot in ride_slots_db if slot.available_capacity > 0]
    
    if date_from:
        slots = [slot for slot in slots if slot.date >= date_from]
    
    result = {}
    for slot in slots:
        date_str = slot.date.isoformat()
        if date_str not in result:
            result[date_str] = {
                "unified": {
                    "card_type": {"id": "", "name": "All Types", "description": "Supports all card types", "price": 0, "duration_minutes": 0},
                    "slots": []
                }
            }
        
        result[date_str]["unified"]["slots"].append({
            "id": slot.id,
            "start_time": slot.start_time.strftime("%H:%M"),
            "end_time": slot.end_time.strftime("%H:%M"),
            "available_capacity": slot.available_capacity,
            "total_capacity": slot.total_capacity
        })
    
    return result

@app.post("/bookings")
async def create_booking(booking_request: BookingRequest):
    ride_slot = next((slot for slot in ride_slots_db if slot.id == booking_request.ride_slot_id), None)
    if not ride_slot or ride_slot.available_capacity == 0:
        raise HTTPException(status_code=400, detail="Valitud aeg ei ole saadaval")
    
    total_quantity = sum(selection.quantity for selection in booking_request.card_selections)
    if total_quantity > ride_slot.available_capacity:
        raise HTTPException(status_code=400, detail="Ei ole piisavalt vabu kohti")
    
    customer = next((c for c in customers_db if c.email == booking_request.customer_email), None)
    if not customer:
        customer = Customer(
            id=str(uuid.uuid4()),
            first_name=booking_request.customer_first_name,
            last_name=booking_request.customer_last_name,
            email=booking_request.customer_email,
            phone=booking_request.customer_phone
        )
        customers_db.append(customer)
    
    total_price = 0.0
    for selection in booking_request.card_selections:
        card_type = next(c for c in card_types_db if c.id == selection.card_type_id)
        total_price += card_type.price * selection.quantity
    
    booking = Booking(
        id=str(uuid.uuid4()),
        customer_id=customer.id,
        ride_slot_id=booking_request.ride_slot_id,
        card_selections=booking_request.card_selections,
        date=ride_slot.date,
        start_time=ride_slot.start_time,
        end_time=ride_slot.end_time,
        status="kinnitatud",
        total_price=total_price,
        notes=booking_request.notes
    )
    
    bookings_db.append(booking)
    
    ride_slot.available_capacity -= total_quantity
    
    return {
        "booking_id": booking.id,
        "message": "Broneering edukalt loodud",
        "booking": booking
    }

@app.get("/bookings/{booking_id}")
async def get_booking(booking_id: str):
    booking = next((b for b in bookings_db if b.id == booking_id), None)
    if not booking:
        raise HTTPException(status_code=404, detail="Broneeringut ei leitud")
    
    customer = next(c for c in customers_db if c.id == booking.customer_id)
    ride_slot = next(r for r in ride_slots_db if r.id == booking.ride_slot_id)
    card_type = next((c for c in card_types_db if c.id == ride_slot.card_type_id), None) if ride_slot.card_type_id else None
    
    return {
        "booking": booking,
        "customer": customer,
        "ride_slot": ride_slot,
        "card_type": card_type
    }

@app.post("/admin/card-types")
async def create_card_type(card_type: CardType):
    card_types_db.append(card_type)
    return {"message": "Kardi tüüp edukalt lisatud", "card_type": card_type}

@app.put("/admin/card-types/{card_type_id}")
async def update_card_type(card_type_id: str, card_type: CardType):
    existing_card = next((c for c in card_types_db if c.id == card_type_id), None)
    if not existing_card:
        raise HTTPException(status_code=404, detail="Kardi tüüpi ei leitud")
    
    for i, c in enumerate(card_types_db):
        if c.id == card_type_id:
            card_types_db[i] = card_type
            break
    
    return {"message": "Kardi tüüp edukalt uuendatud", "card_type": card_type}

@app.delete("/admin/card-types/{card_type_id}")
async def delete_card_type(card_type_id: str):
    card_types_db[:] = [c for c in card_types_db if c.id != card_type_id]
    return {"message": "Kardi tüüp edukalt kustutatud"}

@app.get("/admin/bookings")
async def get_all_bookings():
    bookings_with_details = []
    for booking in bookings_db:
        customer = next(c for c in customers_db if c.id == booking.customer_id)
        ride_slot = next(r for r in ride_slots_db if r.id == booking.ride_slot_id)
        
        bookings_with_details.append({
            "id": booking.id,
            "booking_number": f"BR-{booking.id[:8].upper()}",
            "date": booking.date.isoformat(),
            "start_time": booking.start_time.strftime("%H:%M"),
            "end_time": booking.end_time.strftime("%H:%M"),
            "customer_name": f"{customer.first_name} {customer.last_name}",
            "customer_email": customer.email,
            "customer_phone": customer.phone,
            "total_price": booking.total_price,
            "status": booking.status,
            "card_selections": booking.card_selections,
            "notes": booking.notes
        })
    
    return sorted(bookings_with_details, key=lambda x: x["date"], reverse=True)

@app.get("/admin/opening-hours")
async def get_opening_hours():
    return opening_hours_db

@app.put("/admin/opening-hours/{weekday}")
async def update_opening_hours(weekday: int, hours: OpeningHours):
    for i, h in enumerate(opening_hours_db):
        if h.weekday == weekday:
            opening_hours_db[i] = hours
            break
    
    refresh_ride_slots()
    return {"message": "Lahtiolekuajad uuendatud"}

@app.get("/admin/holidays")
async def get_holidays():
    return holidays_db

@app.post("/admin/holidays")
async def create_holiday(holiday: Holiday):
    holiday.id = str(uuid.uuid4())
    holidays_db.append(holiday)
    
    refresh_ride_slots()
    return {"message": "Puhkepäev lisatud", "holiday": holiday}

@app.delete("/admin/holidays/{holiday_id}")
async def delete_holiday(holiday_id: str):
    holidays_db[:] = [h for h in holidays_db if h.id != holiday_id]
    
    refresh_ride_slots()
    return {"message": "Puhkepäev kustutatud"}

@app.get("/admin/booking-settings")
async def get_booking_settings():
    return booking_settings_db

@app.put("/admin/booking-settings")
async def update_booking_settings(settings: BookingSettings):
    global booking_settings_db
    booking_settings_db = settings
    
    refresh_ride_slots()
    return {"message": "Broneerimise seaded uuendatud", "settings": settings}
