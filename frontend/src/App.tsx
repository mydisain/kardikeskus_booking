import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { Calendar, Clock, User, Car, CheckCircle, Plus, Minus, ShoppingCart, Home, Settings, Users, FileText, Search, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface CardType {
  id: string
  name: string
  description: string
  price: number
  duration_minutes: number
}

interface RideSlot {
  id: string
  start_time: string
  end_time: string
  available_capacity: number
  total_capacity: number
}

interface DaySlots {
  [cardTypeId: string]: {
    card_type: CardType
    slots: RideSlot[]
  }
}

interface AvailableSlots {
  [date: string]: DaySlots
}

interface CardSelection {
  card_type_id: string
  quantity: number
}

interface SelectedRide {
  slot_id: string
  start_time: string
  card_selections: CardSelection[]
  total_price: number
}

function ClientView() {
  const [cardTypes, setCardTypes] = useState<CardType[]>([])
  const [availableSlots, setAvailableSlots] = useState<AvailableSlots>({})
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [selectedSlot, setSelectedSlot] = useState<string>('')
  const [cardSelections, setCardSelections] = useState<CardSelection[]>([])
  const [selectedRides, setSelectedRides] = useState<SelectedRide[]>([])
  const [customerData, setCustomerData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCardTypes()
    fetchAvailableSlots()
  }, [])

  const fetchCardTypes = async () => {
    try {
      const response = await fetch(`${API_URL}/card-types`)
      const data = await response.json()
      setCardTypes(data)
    } catch (err) {
      setError('Viga kartide tüüpide laadimisel')
    }
  }

  const fetchAvailableSlots = async () => {
    try {
      const response = await fetch(`${API_URL}/ride-slots`)
      const data = await response.json()
      setAvailableSlots(data)
    } catch (err) {
      setError('Viga vabade aegade laadimisel')
    }
  }

  const handleCardQuantityChange = (cardTypeId: string, quantity: number) => {
    setCardSelections(prev => {
      const existing = prev.find(s => s.card_type_id === cardTypeId)
      if (existing) {
        if (quantity === 0) {
          return prev.filter(s => s.card_type_id !== cardTypeId)
        }
        return prev.map(s => s.card_type_id === cardTypeId ? { ...s, quantity } : s)
      } else if (quantity > 0) {
        return [...prev, { card_type_id: cardTypeId, quantity }]
      }
      return prev
    })
  }

  const addRideToSelection = () => {
    if (!selectedSlot || cardSelections.length === 0) {
      setError('Palun valige aeg ja vähemalt üks kart')
      return
    }

    const slot = getSelectedSlotDetails()
    if (!slot) return

    const totalPrice = cardSelections.reduce((sum, selection) => {
      const cardType = cardTypes.find(c => c.id === selection.card_type_id)
      return sum + (cardType ? cardType.price * selection.quantity : 0)
    }, 0)

    const newRide: SelectedRide = {
      slot_id: selectedSlot,
      start_time: slot.start_time,
      card_selections: [...cardSelections],
      total_price: totalPrice
    }

    setSelectedRides(prev => [...prev, newRide])
    setSelectedSlot('')
    setCardSelections([])
    setError(null)
  }

  const removeRideFromSelection = (index: number) => {
    setSelectedRides(prev => prev.filter((_, i) => i !== index))
  }

  const handleBooking = async () => {
    if (selectedRides.length === 0 || !customerData.firstName || !customerData.lastName || !customerData.email || !customerData.phone) {
      setError('Palun täitke kõik kohustuslikud väljad ja lisage vähemalt üks sõit')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      for (const ride of selectedRides) {
        const response = await fetch(`${API_URL}/bookings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer_first_name: customerData.firstName,
            customer_last_name: customerData.lastName,
            customer_email: customerData.email,
            customer_phone: customerData.phone,
            ride_slot_id: ride.slot_id,
            card_selections: ride.card_selections,
            notes: customerData.notes
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.detail || 'Viga broneeringul')
        }
      }

      setBookingSuccess(`${selectedRides.length} sõitu edukalt broneeritud!`)
      fetchAvailableSlots()
      setSelectedRides([])
      setCustomerData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        notes: ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Viga broneeringul')
    } finally {
      setIsLoading(false)
    }
  }

  const getAvailableSlotsForDate = () => {
    if (!selectedDate) return []
    const daySlots = availableSlots[selectedDate]
    if (!daySlots) return []
    
    const allSlots: (RideSlot & { card_type: CardType })[] = []
    Object.values(daySlots).forEach(cardTypeSlots => {
      cardTypeSlots.slots.forEach(slot => {
        allSlots.push({ ...slot, card_type: cardTypeSlots.card_type })
      })
    })
    
    return allSlots.sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  const getSelectedSlotDetails = () => {
    const slots = getAvailableSlotsForDate()
    return slots.find(slot => slot.id === selectedSlot)
  }

  const getTotalSelectedPrice = () => {
    return selectedRides.reduce((sum, ride) => sum + ride.total_price, 0)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Car className="h-12 w-12 text-blue-500 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Kartide Broneerimissüsteem</h1>
          </div>
          <p className="text-xl text-gray-600">Broneeri oma kartide sõit</p>
        </div>

        {bookingSuccess && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Broneering edukalt loodud! Broneeringu ID: {bookingSuccess}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Vali aeg ja kartid
                </CardTitle>
                <CardDescription>
                  Vali kuupäev, aeg ja kartide tüübid oma sõiduks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="date">Kuupäev</Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full"
                  />
                </div>

                {selectedDate && (
                  <div>
                    <Label>Vabad ajad</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
                      {getAvailableSlotsForDate().map(slot => (
                        <Button
                          key={slot.id}
                          variant={selectedSlot === slot.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedSlot(slot.id)}
                          className="text-sm flex flex-col items-center justify-center p-2 h-16"
                        >
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {slot.start_time}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {slot.available_capacity}/{slot.total_capacity}
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedSlot && (
                  <div>
                    <Label>Vali kartide tüübid ja kogused</Label>
                    <div className="space-y-3 mt-2">
                      {cardTypes.map(cardType => (
                        <div key={cardType.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-medium">{cardType.name}</h4>
                            <p className="text-sm text-gray-600">{cardType.description}</p>
                            <p className="text-sm font-medium text-green-600">{cardType.price}€ / {cardType.duration_minutes} min</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const current = cardSelections.find(s => s.card_type_id === cardType.id)?.quantity || 0
                                handleCardQuantityChange(cardType.id, Math.max(0, current - 1))
                              }}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center">
                              {cardSelections.find(s => s.card_type_id === cardType.id)?.quantity || 0}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const current = cardSelections.find(s => s.card_type_id === cardType.id)?.quantity || 0
                                const slot = getSelectedSlotDetails()
                                const totalSelected = cardSelections.reduce((sum, s) => sum + s.quantity, 0)
                                if (slot && totalSelected < slot.available_capacity) {
                                  handleCardQuantityChange(cardType.id, current + 1)
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {cardSelections.length > 0 && (
                      <Button onClick={addRideToSelection} className="w-full mt-4">
                        <Plus className="h-4 w-4 mr-2" />
                        Lisa sõit valikusse
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {selectedRides.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Valitud sõidud
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedRides.map((ride, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium">{ride.start_time}</div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeRideFromSelection(index)}
                          >
                            ×
                          </Button>
                        </div>
                        {ride.card_selections.map(selection => {
                          const cardType = cardTypes.find(c => c.id === selection.card_type_id)
                          return (
                            <div key={selection.card_type_id} className="text-sm text-gray-600">
                              {cardType?.name} × {selection.quantity}
                            </div>
                          )
                        })}
                        <div className="text-sm font-medium text-green-600 mt-1">
                          {ride.total_price}€
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t">
                      <div className="font-bold">Kokku: {getTotalSelectedPrice()}€</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Kliendi andmed
                </CardTitle>
                <CardDescription>
                  Sisesta oma kontaktandmed broneeringu kinnitamiseks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Eesnimi *</Label>
                    <Input
                      id="firstName"
                      value={customerData.firstName}
                      onChange={(e) => setCustomerData({...customerData, firstName: e.target.value})}
                      placeholder="Eesnimi"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Perekonnanimi *</Label>
                    <Input
                      id="lastName"
                      value={customerData.lastName}
                      onChange={(e) => setCustomerData({...customerData, lastName: e.target.value})}
                      placeholder="Perekonnanimi"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">E-post *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerData.email}
                    onChange={(e) => setCustomerData({...customerData, email: e.target.value})}
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telefon *</Label>
                  <Input
                    id="phone"
                    value={customerData.phone}
                    onChange={(e) => setCustomerData({...customerData, phone: e.target.value})}
                    placeholder="+372 5xxxxxxx"
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Märkused</Label>
                  <Textarea
                    id="notes"
                    value={customerData.notes}
                    onChange={(e) => setCustomerData({...customerData, notes: e.target.value})}
                    placeholder="Lisainfo või märkused..."
                    rows={3}
                  />
                </div>

                <Button 
                  onClick={handleBooking} 
                  disabled={selectedRides.length === 0 || isLoading}
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? 'Broneerib...' : `Kinnita broneering (${getTotalSelectedPrice()}€)`}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}


function AdminSidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  const menuItems = [
    { id: 'dashboard', label: 'Töölaud', icon: Home, path: '/admin' },
    { id: 'cards', label: 'Kardid', icon: Car, path: '/admin/cards' },
    { id: 'bookings', label: 'Broneeringud', icon: FileText, path: '/admin/bookings' },
    { id: 'settings', label: 'Seaded', icon: Settings, path: '/admin/settings' },
    { id: 'users', label: 'Kasutajad', icon: Users, path: '/admin/users' },
  ]

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <h2 className="text-lg font-semibold">Admin Haldusliides</h2>
        <Link to="/" className="text-sm text-blue-600 hover:text-blue-800">← Tagasi kliendivaadetesse</Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.path)}
                    isActive={location.pathname === item.path}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}

function AdminDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Töölaud</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Broneeringute Ülevaade</h2>
        <ClientView />
      </div>
    </div>
  )
}

function AdminCards() {
  const [cardTypes, setCardTypes] = useState<CardType[]>([])
  const [newCardType, setNewCardType] = useState({
    name: '',
    description: '',
    price: 0,
    duration_minutes: 10
  })
  const [editingCard, setEditingCard] = useState<CardType | null>(null)

  useEffect(() => {
    fetchCardTypes()
  }, [])

  const fetchCardTypes = async () => {
    try {
      const response = await fetch(`${API_URL}/card-types`)
      const data = await response.json()
      setCardTypes(data)
    } catch (error) {
      console.error('Error fetching card types:', error)
    }
  }

  const createCardType = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/card-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Date.now().toString(),
          ...newCardType
        })
      })
      if (response.ok) {
        setNewCardType({ name: '', description: '', price: 0, duration_minutes: 10 })
        fetchCardTypes()
      }
    } catch (error) {
      console.error('Error creating card type:', error)
    }
  }

  const updateCardType = async () => {
    if (!editingCard) return
    try {
      const response = await fetch(`${API_URL}/admin/card-types/${editingCard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCard)
      })
      if (response.ok) {
        setEditingCard(null)
        fetchCardTypes()
      }
    } catch (error) {
      console.error('Error updating card type:', error)
    }
  }

  const deleteCardType = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/card-types/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchCardTypes()
      }
    } catch (error) {
      console.error('Error deleting card type:', error)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Kartide Haldus</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Kartide Tüübid</h2>
        
        <div className="space-y-4 mb-6">
          {cardTypes.map((card) => (
            <div key={card.id} className="border rounded p-4">
              {editingCard?.id === card.id ? (
                <div className="space-y-2">
                  <Input
                    type="text"
                    value={editingCard.name}
                    onChange={(e) => setEditingCard({...editingCard, name: e.target.value})}
                    placeholder="Nimi"
                  />
                  <Input
                    type="text"
                    value={editingCard.description}
                    onChange={(e) => setEditingCard({...editingCard, description: e.target.value})}
                    placeholder="Kirjeldus"
                  />
                  <Input
                    type="number"
                    value={editingCard.price}
                    onChange={(e) => setEditingCard({...editingCard, price: parseFloat(e.target.value)})}
                    placeholder="Hind"
                  />
                  <Input
                    type="number"
                    value={editingCard.duration_minutes}
                    onChange={(e) => setEditingCard({...editingCard, duration_minutes: parseInt(e.target.value)})}
                    placeholder="Kestus (minutid)"
                  />
                  <div className="flex gap-2">
                    <Button onClick={updateCardType} size="sm">Salvesta</Button>
                    <Button onClick={() => setEditingCard(null)} variant="outline" size="sm">Tühista</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="font-semibold">{card.name}</h3>
                  <p className="text-gray-600">{card.description}</p>
                  <p className="text-green-600 font-semibold">{card.price}€ / {card.duration_minutes} min</p>
                  <div className="flex gap-2 mt-2">
                    <Button onClick={() => setEditingCard(card)} size="sm" variant="outline">Muuda</Button>
                    <Button onClick={() => deleteCardType(card.id)} size="sm" variant="destructive">Kustuta</Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t pt-4">
          <h3 className="font-semibold mb-2">Lisa Uus Kardi Tüüp</h3>
          <div className="space-y-2">
            <Input
              type="text"
              value={newCardType.name}
              onChange={(e) => setNewCardType({...newCardType, name: e.target.value})}
              placeholder="Nimi"
            />
            <Input
              type="text"
              value={newCardType.description}
              onChange={(e) => setNewCardType({...newCardType, description: e.target.value})}
              placeholder="Kirjeldus"
            />
            <Input
              type="number"
              value={newCardType.price}
              onChange={(e) => setNewCardType({...newCardType, price: parseFloat(e.target.value)})}
              placeholder="Hind"
            />
            <Input
              type="number"
              value={newCardType.duration_minutes}
              onChange={(e) => setNewCardType({...newCardType, duration_minutes: parseInt(e.target.value)})}
              placeholder="Kestus (minutid)"
            />
            <Button onClick={createCardType} className="w-full">Lisa Kardi Tüüp</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Booking {
  id: string
  booking_number: string
  date: string
  start_time: string
  end_time: string
  customer_name: string
  customer_email: string
  customer_phone: string
  total_price: number
  status: string
  card_selections: CardSelection[]
  notes?: string
}

function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [cardTypes, setCardTypes] = useState<CardType[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<keyof Booking>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  useEffect(() => {
    fetchBookings()
    fetchCardTypes()
  }, [])

  const fetchBookings = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/bookings`)
      if (response.ok) {
        const data = await response.json()
        setBookings(Array.isArray(data) ? data : [])
      } else {
        console.error('Failed to fetch bookings:', response.status)
        setBookings([])
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
      setBookings([])
    }
  }

  const fetchCardTypes = async () => {
    try {
      const response = await fetch(`${API_URL}/card-types`)
      if (response.ok) {
        const data = await response.json()
        setCardTypes(Array.isArray(data) ? data : [])
      } else {
        console.error('Failed to fetch card types:', response.status)
        setCardTypes([])
      }
    } catch (error) {
      console.error('Error fetching card types:', error)
      setCardTypes([])
    }
  }

  const filteredBookings = bookings.filter(booking =>
    booking.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.booking_number.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const sortedBookings = [...filteredBookings].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]
    const direction = sortDirection === 'asc' ? 1 : -1
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue.localeCompare(bValue) * direction
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * direction
    }
    return 0
  })

  const handleSort = (field: keyof Booking) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getCardTypeName = (cardTypeId: string) => {
    const cardType = cardTypes.find(ct => ct.id === cardTypeId)
    return cardType ? cardType.name : `Kardi tüüp ${cardTypeId}`
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Broneeringud</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Otsi broneeringuid..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('booking_number')}
              >
                Broneeringu nr
                {sortField === 'booking_number' && (
                  sortDirection === 'asc' ? <ChevronUp className="inline w-4 h-4 ml-1" /> : <ChevronDown className="inline w-4 h-4 ml-1" />
                )}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('date')}
              >
                Kuupäev
                {sortField === 'date' && (
                  sortDirection === 'asc' ? <ChevronUp className="inline w-4 h-4 ml-1" /> : <ChevronDown className="inline w-4 h-4 ml-1" />
                )}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('customer_name')}
              >
                Kliendi nimi
                {sortField === 'customer_name' && (
                  sortDirection === 'asc' ? <ChevronUp className="inline w-4 h-4 ml-1" /> : <ChevronDown className="inline w-4 h-4 ml-1" />
                )}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('customer_email')}
              >
                Email
                {sortField === 'customer_email' && (
                  sortDirection === 'asc' ? <ChevronUp className="inline w-4 h-4 ml-1" /> : <ChevronDown className="inline w-4 h-4 ml-1" />
                )}
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => handleSort('total_price')}
              >
                Summa
                {sortField === 'total_price' && (
                  sortDirection === 'asc' ? <ChevronUp className="inline w-4 h-4 ml-1" /> : <ChevronDown className="inline w-4 h-4 ml-1" />
                )}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedBookings.map((booking) => (
              <TableRow 
                key={booking.id} 
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedBooking(booking)}
              >
                <TableCell className="font-medium">{booking.booking_number}</TableCell>
                <TableCell>{booking.date} {booking.start_time}</TableCell>
                <TableCell>{booking.customer_name}</TableCell>
                <TableCell>{booking.customer_email}</TableCell>
                <TableCell>{booking.total_price}€</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selectedBooking && (
          <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Broneeringu üksikasjad</DialogTitle>
                <DialogDescription>
                  Broneeringu number: {selectedBooking.booking_number}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="font-semibold">Klient</Label>
                    <p>{selectedBooking.customer_name}</p>
                    <p className="text-sm text-gray-600">{selectedBooking.customer_email}</p>
                    <p className="text-sm text-gray-600">{selectedBooking.customer_phone}</p>
                  </div>
                  <div>
                    <Label className="font-semibold">Aeg</Label>
                    <p>{selectedBooking.date}</p>
                    <p className="text-sm text-gray-600">{selectedBooking.start_time} - {selectedBooking.end_time}</p>
                  </div>
                </div>

                <div>
                  <Label className="font-semibold">Valitud kartid</Label>
                  <div className="mt-2 space-y-2">
                    {selectedBooking.card_selections.map((selection, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span>{getCardTypeName(selection.card_type_id)}</span>
                        <span>Kogus: {selection.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="font-semibold">Kogusumma:</span>
                  <span className="text-lg font-bold text-green-600">{selectedBooking.total_price}€</span>
                </div>

                {selectedBooking.notes && (
                  <div>
                    <Label className="font-semibold">Märkused</Label>
                    <p className="mt-1 text-sm text-gray-600">{selectedBooking.notes}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}

interface OpeningHours {
  weekday: number
  start_time: string
  end_time: string
  is_closed: boolean
}

interface Holiday {
  id: string
  date: string
  name: string
  start_time?: string
  end_time?: string
  is_closed: boolean
}

interface BookingSettings {
  interval_minutes: number
  max_booking_duration_minutes: number
  advance_booking_days: number
  max_cards_per_slot: number
}

function AdminSettings() {
  const [openingHours, setOpeningHours] = useState<OpeningHours[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>({
    interval_minutes: 30,
    max_booking_duration_minutes: 60,
    advance_booking_days: 30,
    max_cards_per_slot: 8
  })
  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: '',
    is_closed: true
  })

  const weekdays = ['Esmaspäev', 'Teisipäev', 'Kolmapäev', 'Neljapäev', 'Reede', 'Laupäev', 'Pühapäev']

  useEffect(() => {
    fetchOpeningHours()
    fetchHolidays()
    fetchBookingSettings()
  }, [])

  const fetchOpeningHours = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/opening-hours`)
      if (response.ok) {
        const data = await response.json()
        setOpeningHours(Array.isArray(data) ? data : [])
      } else {
        console.error('Failed to fetch opening hours:', response.status)
        setOpeningHours([])
      }
    } catch (error) {
      console.error('Error fetching opening hours:', error)
      setOpeningHours([])
    }
  }

  const fetchHolidays = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/holidays`)
      if (response.ok) {
        const data = await response.json()
        setHolidays(Array.isArray(data) ? data : [])
      } else {
        console.error('Failed to fetch holidays:', response.status)
        setHolidays([])
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
      setHolidays([])
    }
  }

  const fetchBookingSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/booking-settings`)
      if (response.ok) {
        const data = await response.json()
        setBookingSettings(data)
      } else {
        console.error('Failed to fetch booking settings:', response.status)
      }
    } catch (error) {
      console.error('Error fetching booking settings:', error)
    }
  }

  const updateOpeningHours = async (weekday: number, hours: OpeningHours) => {
    try {
      const response = await fetch(`${API_URL}/admin/opening-hours/${weekday}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hours)
      })
      if (response.ok) {
        fetchOpeningHours()
      }
    } catch (error) {
      console.error('Error updating opening hours:', error)
    }
  }

  const createHoliday = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHoliday)
      })
      if (response.ok) {
        setNewHoliday({ date: '', name: '', is_closed: true })
        fetchHolidays()
      }
    } catch (error) {
      console.error('Error creating holiday:', error)
    }
  }

  const deleteHoliday = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/admin/holidays/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        fetchHolidays()
      }
    } catch (error) {
      console.error('Error deleting holiday:', error)
    }
  }

  const updateBookingSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/booking-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingSettings)
      })
      if (response.ok) {
        alert('Seaded salvestatud!')
      }
    } catch (error) {
      console.error('Error updating booking settings:', error)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Seaded</h1>
      
      <Tabs defaultValue="hours" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="hours">Kellaajad</TabsTrigger>
          <TabsTrigger value="booking">Aja seaded</TabsTrigger>
        </TabsList>
        
        <TabsContent value="hours" className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Lahtiolekuajad</h2>
            
            <div className="space-y-4">
              {openingHours.map((hours) => (
                <div key={hours.weekday} className="flex items-center justify-between p-4 border rounded">
                  <div className="flex items-center space-x-4">
                    <span className="w-24 font-medium">{weekdays[hours.weekday]}</span>
                    <Switch
                      checked={!hours.is_closed}
                      onCheckedChange={(checked) => {
                        const updated = { ...hours, is_closed: !checked }
                        updateOpeningHours(hours.weekday, updated)
                      }}
                    />
                  </div>
                  
                  {!hours.is_closed && (
                    <div className="flex items-center space-x-2">
                      <Input
                        type="time"
                        value={hours.start_time}
                        onChange={(e) => {
                          const updated = { ...hours, start_time: e.target.value }
                          updateOpeningHours(hours.weekday, updated)
                        }}
                        className="w-32"
                      />
                      <span>-</span>
                      <Input
                        type="time"
                        value={hours.end_time}
                        onChange={(e) => {
                          const updated = { ...hours, end_time: e.target.value }
                          updateOpeningHours(hours.weekday, updated)
                        }}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Puhkepäevad</h2>
            
            <div className="space-y-4 mb-6">
              {holidays.map((holiday) => (
                <div key={holiday.id} className="flex items-center justify-between p-4 border rounded">
                  <div>
                    <span className="font-medium">{holiday.name}</span>
                    <span className="ml-2 text-gray-600">{holiday.date}</span>
                  </div>
                  <Button onClick={() => deleteHoliday(holiday.id)} variant="destructive" size="sm">
                    Kustuta
                  </Button>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Lisa Puhkepäev</h3>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})}
                  className="flex-1"
                />
                <Input
                  type="text"
                  placeholder="Puhkepäeva nimi"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({...newHoliday, name: e.target.value})}
                  className="flex-1"
                />
                <Button onClick={createHoliday}>Lisa</Button>
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="booking">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Broneerimise seaded</h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="interval">Intervall (minutites)</Label>
                <Input
                  id="interval"
                  type="number"
                  value={bookingSettings.interval_minutes}
                  onChange={(e) => setBookingSettings({...bookingSettings, interval_minutes: parseInt(e.target.value)})}
                  className="mt-1"
                />
                <p className="text-sm text-gray-600 mt-1">Millise intervalliga saavad kasutajad karte broneerida</p>
              </div>

              <div>
                <Label htmlFor="maxDuration">Max broneeringu aeg (minutites)</Label>
                <Input
                  id="maxDuration"
                  type="number"
                  value={bookingSettings.max_booking_duration_minutes}
                  onChange={(e) => setBookingSettings({...bookingSettings, max_booking_duration_minutes: parseInt(e.target.value)})}
                  className="mt-1"
                />
                <p className="text-sm text-gray-600 mt-1">Kui mitu ajaühikut saavad kasutajad korraga broneerida</p>
              </div>

              <div>
                <Label htmlFor="advanceDays">Broneeringu päevi ette</Label>
                <Input
                  id="advanceDays"
                  type="number"
                  value={bookingSettings.advance_booking_days}
                  onChange={(e) => setBookingSettings({...bookingSettings, advance_booking_days: parseInt(e.target.value)})}
                  className="mt-1"
                />
                <p className="text-sm text-gray-600 mt-1">Kui pikalt saavad kliendid ette broneeringuid teha</p>
              </div>

              <div>
                <Label htmlFor="maxCards">Max kartide arv</Label>
                <Input
                  id="maxCards"
                  type="number"
                  value={bookingSettings.max_cards_per_slot}
                  onChange={(e) => setBookingSettings({...bookingSettings, max_cards_per_slot: parseInt(e.target.value)})}
                  className="mt-1"
                />
                <p className="text-sm text-gray-600 mt-1">Mitu karti maksimaalselt ühele ajaühikule lubatakse</p>
              </div>

              <Button onClick={updateBookingSettings} className="w-full">
                Salvesta seaded
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AdminUsers() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Kasutajad</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">Kasutajate haldus tuleb peagi...</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ClientView />} />
        <Route path="/admin/*" element={
          <SidebarProvider>
            <div className="flex min-h-screen">
              <AdminSidebar />
              <SidebarInset className="flex-1">
                <Routes>
                  <Route index element={<AdminDashboard />} />
                  <Route path="cards" element={<AdminCards />} />
                  <Route path="bookings" element={<AdminBookings />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="users" element={<AdminUsers />} />
                </Routes>
              </SidebarInset>
            </div>
          </SidebarProvider>
        } />
      </Routes>
    </Router>
  )
}

export default App
