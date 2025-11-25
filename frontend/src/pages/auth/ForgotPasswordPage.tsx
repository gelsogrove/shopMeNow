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
import { useToast } from "@/components/ui/use-toast"
import { useLanguage } from "@/contexts/LanguageContext"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { Link } from "react-router-dom"
import * as z from "zod"

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
})

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const { toast } = useToast()
  const { t, language } = useLanguage() // 🌍 Get language from context

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  })

  const onSubmit = async (data: ForgotPasswordForm) => {
    try {
      setIsLoading(true)
      setError("")

      // 🌍 Map language to Accept-Language header value
      const languageMap: Record<string, string> = {
        it: "it-IT",
        en: "en-US",
        es: "es-ES",
        pt: "pt-PT",
      }

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept-Language": languageMap[language] || "it-IT", // 🌍 Send user's language
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to process request")
      }

      setSuccess(true)
      toast({
        title: t("forgotPassword.title"),
        description: t("forgotPassword.success"),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-background">
      <AuthLogo />
      <div className="container mx-auto px-4 flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md font-system bg-white/95 backdrop-blur-sm shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-bold text-center">
              {t("forgotPassword.title")}
            </CardTitle>
            <CardDescription className="text-center">
              {t("forgotPassword.subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <Alert>
                <AlertDescription className="text-center">
                  {t("forgotPassword.success")}
                </AlertDescription>
              </Alert>
            ) : (
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("form.email")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("forgotPassword.email.placeholder")}
                            type="email"
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
                      <span className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("resetPassword.button.loading")}
                      </span>
                    ) : (
                      t("forgotPassword.button")
                    )}
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <p className="text-sm text-muted-foreground">
              <Link
                to="/auth/login"
                className="text-green-500 hover:text-green-600 hover:underline"
              >
                {t("forgotPassword.backToLogin")}
              </Link>
            </p>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <Link to="/privacy" className="hover:underline">
                {t("footer.privacy")}
              </Link>
              <span>•</span>
              <Link to="/terms" className="hover:underline">
                {t("footer.terms")}
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
