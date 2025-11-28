import { Alert, AlertDescription } from "@/components/ui/alert"
import { AuthLogo } from "@/components/ui/auth-logo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { QRCodeDisplay } from "@/components/ui/qr-code"
import { useToast } from "@/hooks/use-toast"
import { logger } from "@/lib/logger"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useNavigate, useSearchParams } from "react-router-dom"
import * as z from "zod"

const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be exactly 6 digits"),
})

type OtpForm = z.infer<typeof otpSchema>

export default function VerifyOtpPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const userId = searchParams.get("userId")

  const form = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: "",
    },
  })

  useEffect(() => {
    if (!userId) {
      navigate("/auth/login")
    }
  }, [userId, navigate])

  const onSubmit = async (data: OtpForm) => {
    try {
      setIsLoading(true)
      setError("")

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          otp: data.otp,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to verify OTP")
      }

      const { token } = await response.json()

      // Store the token
      localStorage.setItem("token", token)

      toast({
        title: "Success!",
        description: "OTP verified successfully.",
      })

      // Check if user has workspaces before redirecting
      try {
        const workspacesResponse = await fetch("/api/workspaces", {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          credentials: "include",
        })

        if (workspacesResponse.ok) {
          const workspaces = await workspacesResponse.json()

          if (workspaces && workspaces.length > 0) {
            // User has workspaces, redirect to chat
            navigate("/chat")
          } else {
            // New user with no workspaces, redirect to workspace selection
            navigate("/clients")
          }
        } else {
          // If we can't fetch workspaces, default to workspace selection for safety
          navigate("/clients")
        }
      } catch (workspaceError) {
        logger.warn(
          "Could not fetch workspaces, redirecting to workspace selection:",
          workspaceError
        )
        // If there's an error fetching workspaces, redirect to workspace selection
        navigate("/clients")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto flex h-screen items-center justify-center">
      <AuthLogo />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-center">
            ShopMe Security
          </CardTitle>
          <CardDescription className="text-center">
            Scan the QR code with your authenticator app and enter the code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <QRCodeDisplay userId={userId} />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Enter 6-digit code</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123456"
                        maxLength={6}
                        pattern="\d*"
                        inputMode="numeric"
                        className="text-center text-lg tracking-widest"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-green-500 hover:bg-green-600 text-white font-medium"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Didn't receive the code?{" "}
            <Button
              variant="link"
              className="p-0 text-primary hover:underline"
              onClick={() => {
                // TODO: Implement resend OTP
                toast({
                  title: "New code sent!",
                  description: "Please check your email for the new code.",
                })
              }}
            >
              Resend
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
