import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle } from "lucide-react"

export function PayPalResultPage() {
  const [searchParams] = useSearchParams()
  const status = searchParams.get("paypal")

  const handleCloseWithRefresh = () => {
    // Refresh parent window to show updated PayPal connection status
    if (window.opener && !window.opener.closed) {
      window.opener.location.reload()
    }
    window.close()
  }

  const getContent = () => {
    switch (status) {
      case "subscription_approved":
        return {
          icon: <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />,
          title: "PayPal Connection Successful!",
          description:
            "Your PayPal account has been successfully connected. You can now manage your subscription and receive automatic payments.",
          nextSteps: [
            "Your subscription is now active",
            "Monthly payments will be processed automatically",
            "You can manage your subscription anytime from your workspace settings",
          ],
          action: (
            <Button
              className="mt-4"
              onClick={handleCloseWithRefresh}
            >
              Close Window
            </Button>
          ),
        }

      case "error":
        return {
          icon: <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />,
          title: "PayPal Connection Failed",
          description:
            "We encountered an issue while connecting your PayPal account. This might be due to:",
          nextSteps: [
            "The subscription was not properly approved",
            "Network connectivity issues",
            "PayPal service temporary unavailable",
          ],
          action: (
            <div className="space-y-4 mt-6">
              <p className="text-sm text-gray-600">
                Please try again or contact our support team for assistance.
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={handleCloseWithRefresh}>
                  Close Window
                </Button>
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = "mailto:support@echatbot.ai")}
                >
                  Contact Support
                </Button>
              </div>
            </div>
          ),
        }

      case "cancelled":
        return {
          icon: <XCircle className="h-16 w-16 text-orange-500 mx-auto mb-4" />,
          title: "PayPal Connection Cancelled",
          description: "You cancelled the PayPal connection process.",
          nextSteps: [
            "No changes were made to your account",
            "You can try connecting PayPal again anytime",
          ],
          action: (
            <Button
              className="mt-6"
              onClick={handleCloseWithRefresh}
            >
              Close Window
            </Button>
          ),
        }

      default:
        return {
          icon: <Loader2 className="h-16 w-16 text-blue-500 mx-auto mb-4 animate-spin" />,
          title: "Processing...",
          description: "Please wait while we process your PayPal connection.",
          nextSteps: [],
        }
    }
  }

  const content = getContent()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center space-y-4 pb-6">
          {content.icon}

          <div>
            <CardTitle className="text-3xl font-bold text-gray-900 mb-2">
              {content.title}
            </CardTitle>
            <CardDescription className="text-base text-gray-600">
              {content.description}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {content.nextSteps.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">
                {status === "error" ? "Possible Reasons:" : "Next Steps:"}
              </h3>
              <ul className="space-y-2">
                {content.nextSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-700">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium mt-0.5">
                      {index + 1}
                    </span>
                    <span className="text-sm">{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.action}

          {/* Footer */}
          <div className="text-center text-sm text-gray-500 pt-4 border-t">
            <p>
              Need help?{" "}
              <a
                href="mailto:support@echatbot.ai"
                className="text-blue-600 hover:text-blue-700 underline"
              >
                Contact our support team
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
