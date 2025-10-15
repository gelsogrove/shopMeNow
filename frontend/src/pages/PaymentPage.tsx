import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getPublicPageTexts } from "@/utils/publicPageTranslations"
import { CheckCircle, CreditCard, Loader2, Lock } from "lucide-react"
import { useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

/**
 * Payment Page - Stripe-style Mock
 *
 * This is a MOCK payment interface that simulates Stripe's payment flow.
 * NO ACTUAL PAYMENT PROCESSING OCCURS.
 *
 * Flow:
 * 1. User fills in card details (mock validation only)
 * 2. Clicks "Pay Now" button
 * 3. Shows processing animation for 2 seconds
 * 4. Redirects to order confirmation page
 *
 * In production, replace with actual Stripe integration.
 */
export default function PaymentPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Extract data from URL params
  const orderId = searchParams.get("orderId") || ""
  const total = parseFloat(searchParams.get("total") || "0")
  const customerLanguage = searchParams.get("lang") || "IT"
  const texts = getPublicPageTexts(customerLanguage)

  // Payment form state
  const [cardNumber, setCardNumber] = useState("")
  const [cardName, setCardName] = useState("")
  const [expiry, setExpiry] = useState("")
  const [cvv, setCvv] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  // Format card number with spaces (1234 5678 9012 3456)
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "")
    const groups = cleaned.match(/.{1,4}/g) || []
    return groups.join(" ").substring(0, 19) // Max 16 digits + 3 spaces
  }

  // Format expiry date (MM/YY)
  const formatExpiry = (value: string) => {
    const cleaned = value.replace(/\D/g, "")
    if (cleaned.length >= 2) {
      return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`
    }
    return cleaned
  }

  // Validate form (mock validation)
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!cardName.trim()) {
      newErrors.cardName = texts.paymentCardNameRequired || "Name required"
    }

    const cleanedCardNumber = cardNumber.replace(/\s/g, "")
    if (cleanedCardNumber.length !== 16) {
      newErrors.cardNumber =
        texts.paymentCardNumberInvalid || "Invalid card number"
    }

    if (!expiry.match(/^\d{2}\/\d{2}$/)) {
      newErrors.expiry = texts.paymentExpiryInvalid || "Invalid expiry date"
    }

    if (cvv.length !== 3 && cvv.length !== 4) {
      newErrors.cvv = texts.paymentCvvInvalid || "Invalid CVV"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle payment submission (MOCK - no actual processing)
  const handlePayment = async () => {
    if (!validateForm()) return

    setIsProcessing(true)

    // Simulate payment processing delay
    setTimeout(() => {
      // Redirect to order confirmation page
      navigate(`/order-confirmed?orderId=${orderId}&lang=${customerLanguage}`)
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Lock className="w-5 h-5 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">
              {texts.paymentTitle || "Secure Payment"}
            </h1>
          </div>
          <p className="text-gray-600">
            {texts.paymentSubtitle || "Complete your purchase securely"}
          </p>
        </div>

        {/* Payment Card */}
        <Card className="shadow-xl mb-6">
          <CardContent className="p-6">
            {/* Order Summary */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-700 font-medium">
                  {texts.orderCode || "Order"}: #{orderId.substring(0, 8)}
                </span>
                <span className="text-2xl font-bold text-blue-600">
                  €{total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Mock Notice */}
            <Alert className="mb-6 bg-yellow-50 border-yellow-200">
              <AlertDescription className="text-sm text-yellow-800">
                ⚠️{" "}
                {texts.paymentMockNotice ||
                  "This is a mock payment interface. No actual charges will be made."}
              </AlertDescription>
            </Alert>

            {/* Payment Form */}
            <div className="space-y-4">
              {/* Card Number */}
              <div>
                <Label htmlFor="cardNumber" className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  {texts.paymentCardNumber || "Card Number"}
                </Label>
                <Input
                  id="cardNumber"
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={(e) =>
                    setCardNumber(formatCardNumber(e.target.value))
                  }
                  maxLength={19}
                  className={`mt-1 font-mono text-lg ${
                    errors.cardNumber ? "border-red-500" : ""
                  }`}
                  disabled={isProcessing}
                />
                {errors.cardNumber && (
                  <p className="text-sm text-red-600 mt-1">
                    {errors.cardNumber}
                  </p>
                )}
              </div>

              {/* Cardholder Name */}
              <div>
                <Label htmlFor="cardName">
                  {texts.paymentCardName || "Cardholder Name"}
                </Label>
                <Input
                  id="cardName"
                  placeholder="John Doe"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value.toUpperCase())}
                  className={`mt-1 uppercase ${
                    errors.cardName ? "border-red-500" : ""
                  }`}
                  disabled={isProcessing}
                />
                {errors.cardName && (
                  <p className="text-sm text-red-600 mt-1">{errors.cardName}</p>
                )}
              </div>

              {/* Expiry and CVV */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expiry">
                    {texts.paymentExpiry || "Expiry Date"}
                  </Label>
                  <Input
                    id="expiry"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    maxLength={5}
                    className={`mt-1 font-mono ${
                      errors.expiry ? "border-red-500" : ""
                    }`}
                    disabled={isProcessing}
                  />
                  {errors.expiry && (
                    <p className="text-sm text-red-600 mt-1">{errors.expiry}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="cvv">{texts.paymentCvv || "CVV"}</Label>
                  <Input
                    id="cvv"
                    placeholder="123"
                    value={cvv}
                    onChange={(e) =>
                      setCvv(e.target.value.replace(/\D/g, "").substring(0, 4))
                    }
                    maxLength={4}
                    className={`mt-1 font-mono ${
                      errors.cvv ? "border-red-500" : ""
                    }`}
                    disabled={isProcessing}
                    type="password"
                  />
                  {errors.cvv && (
                    <p className="text-sm text-red-600 mt-1">{errors.cvv}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Button */}
            <Button
              onClick={handlePayment}
              disabled={isProcessing}
              className="w-full mt-6 h-12 text-lg font-semibold bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {texts.paymentProcessing || "Processing Payment..."}
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  {texts.paymentPayNow || "Pay Now"} €{total.toFixed(2)}
                </>
              )}
            </Button>

            {/* Security Notice */}
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
              <Lock className="w-4 h-4" />
              <span>
                {texts.paymentSecure || "Your payment information is secure"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Test Cards Info */}
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">
              {texts.paymentTestCards || "Test Cards (Mock)"}:
            </h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>
                • 4242 4242 4242 4242 - {texts.paymentSuccess || "Success"}
              </li>
              <li>• {texts.paymentAnyExpiry || "Any future expiry date"}</li>
              <li>• {texts.paymentAnyCvv || "Any 3-digit CVV"}</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
