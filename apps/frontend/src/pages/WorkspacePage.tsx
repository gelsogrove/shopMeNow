import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../components/ui/button"
import { Card } from "../components/ui/card"
import { Input } from "../components/ui/input"

export function WorkspacePage() {
  const [phone, setPhone] = useState("")
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (phone) {
      // Remove any spaces and make sure it starts with +
      const formattedPhone = phone.replace(/\s/g, "")
      const phoneWithPlus = formattedPhone.startsWith("+")
        ? formattedPhone
        : `+${formattedPhone}`
      navigate(`/login/${phoneWithPlus}`)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="p-8 w-full max-w-md">
        <h1 className="text-lg font-bold text-center mb-6">Enter Workspace</h1>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium mb-1">
              WhatsApp Phone Number
            </label>
            <Input
              id="phone"
              type="tel"
              placeholder="+1234567890"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              pattern="^[+]?[0-9\s]*$"
              title="Please enter a valid phone number starting with +"
            />
          </div>
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </Card>
    </div>
  )
}
