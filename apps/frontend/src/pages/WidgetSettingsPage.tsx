import { useState, useEffect } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, MessageCircle, Sparkles, Bot, LifeBuoy, MessageSquare, Mail, User, Star, Heart, Bell, Shield, Zap } from "lucide-react";
import { toast } from "@/lib/toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ImageCropUpload } from "@/components/shared/ImageCropUpload";
import { ChatWidget } from "@/components/ChatWidget";
import { api } from "@/services/api";
import { IMG_BASE_URL } from "@/config";

export default function WidgetSettingsPage() {
  const { workspace, setCurrentWorkspace } = useWorkspace();
  // Use workspace.logoUrl as single source of truth (same logo for channel + widget)
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [title, setTitle] = useState<string>(workspace?.name || "eChatbot");
  const [language, setLanguage] = useState<string>("it");
  const [primaryColor, setPrimaryColor] = useState<string>("#22c55e");
  const [icon, setIcon] = useState<string>("chat");
  const [useChannelLogo, setUseChannelLogo] = useState<boolean>(false);
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (workspace) {
      // Use logoUrl as single source (channel logo = widget logo)
      setLogoUrl((workspace as any).logoUrl || "");
      setTitle((workspace as any).widgetTitle || workspace.name || "eChatbot");
      setLanguage((workspace as any).widgetLanguage || "it");
      setPrimaryColor((workspace as any).widgetPrimaryColor || "#22c55e");
      setIcon((workspace as any).widgetIcon || "chat");
      setUseChannelLogo((workspace as any).widgetUseChannelLogo ?? false);
    }
  }, [workspace]);

  const getWidgetConfig = () => {
    const apiUrl = import.meta.env.VITE_API_URL ||
      (typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/api/v1`
        : "http://localhost:3001/api/v1");

    return {
      workspaceId: workspace?.id || "YOUR_WORKSPACE_ID",
      apiUrl,
      title,
      logoUrl: useChannelLogo && logoUrl ? `${IMG_BASE_URL}${logoUrl}` : "",
      useChannelLogo,
      icon,
      language,
      primaryColor,
    };
  };

  const translations: Record<string, { welcome: string; placeholder: string }> =
    {
      it: {
        welcome: "Ciao! 👋 Come posso aiutarti?",
        placeholder: "Scrivi un messaggio...",
      },
      en: {
        welcome: "Hello! 👋 How can I help you?",
        placeholder: "Type a message...",
      },
      es: {
        welcome: "¡Hola! 👋 ¿Cómo puedo ayudarte?",
        placeholder: "Escribe un mensaje...",
      },
      pt: {
        welcome: "Olá! 👋 Como posso ajudar?",
        placeholder: "Digite uma mensagem...",
      },
    };

  const languages = [
    { code: "it", name: "Italian" },
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "pt", name: "Portuguese" },
  ];

  const iconOptions = [
    { value: "chat", label: "Chat Bubble", icon: MessageCircle, hint: "Rounded, friendly bubble" },
    { value: "sparkles", label: "Sparkles", icon: Sparkles, hint: "Playful marketing vibe" },
    { value: "support", label: "Human Support", icon: LifeBuoy, hint: "Highlights human help" },
    { value: "bot", label: "Bot", icon: Bot, hint: "Tech-forward feel" },
    { value: "messages", label: "Messages", icon: MessageSquare, hint: "Modern chat interface" },
    { value: "mail", label: "Mail", icon: Mail, hint: "Contact us" },
    { value: "user", label: "User", icon: User, hint: "Personal assistant" },
    { value: "star", label: "Star", icon: Star, hint: "Premium support" },
    { value: "heart", label: "Heart", icon: Heart, hint: "Friendly & caring" },
    { value: "bell", label: "Bell", icon: Bell, hint: "Notifications" },
    { value: "shield", label: "Shield", icon: Shield, hint: "Secure & trusted" },
    { value: "zap", label: "Zap", icon: Zap, hint: "Fast response" },
  ];

  const handleLogoUpload = async (file: File) => {
    console.log("🔵 handleLogoUpload called with file:", file);
    if (!workspace?.id) {
      toast.error("No workspace selected");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      console.log("🔵 Uploading to:", `/workspaces/${workspace.id}/logo`);
      const response = await api.post(
        `/workspaces/${workspace.id}/logo`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      console.log("🔵 Upload response:", response.data);
      if (response.data?.logoUrl) {
        const newLogoUrl = response.data.logoUrl;
        console.log("🔵 Logo uploaded, setting logoUrl:", newLogoUrl);
        // Logo is already saved by POST /logo endpoint
        // Just update local state
        setLogoUrl(newLogoUrl);
        setCurrentWorkspace({
          ...workspace,
          logoUrl: newLogoUrl,
        } as any);
        toast.success("Logo uploaded!");
      } else {
        console.error("🔴 No logoUrl in response:", response.data);
      }
    } catch (error: any) {
      console.error("🔴 Logo upload error:", error);
      console.error("🔴 Error response:", error?.response?.data);
      if (error?.response?.status === 403) {
        toast.error(
          "Permission denied. Only workspace owners can upload logos.",
        );
      } else {
        toast.error("Failed to upload logo");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!workspace?.id) {
      toast.error("No workspace selected");
      return;
    }
    setIsSaving(true);
    try {
      await api.put(`/workspaces/${workspace.id}`, {
        widgetTitle: title,
        widgetLanguage: language,
        widgetPrimaryColor: primaryColor,
        widgetIcon: icon,
        widgetUseChannelLogo: useChannelLogo,
      });
      setCurrentWorkspace({
        ...workspace,
        widgetTitle: title,
        widgetLanguage: language,
        widgetPrimaryColor: primaryColor,
        widgetIcon: icon,
        widgetUseChannelLogo: useChannelLogo,
      } as any);
      toast.success("Widget configuration saved!");
    } catch (error: any) {
      console.error("Save config error:", error);
      if (error?.response?.status === 403) {
        toast.error(
          "Permission denied. Only workspace owners can save configurations.",
        );
      } else {
        toast.error("Failed to save configuration");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const generateEmbedCode = (): string => {
    const cacheBust = "187" // bump to force latest widget.js
    const widgetScriptUrl =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/widget.js?v=${cacheBust}`
        : `http://localhost:3000/widget.js?v=${cacheBust}`;
    const config = getWidgetConfig();
    return `<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = ${JSON.stringify(config, null, 2)};
</script>
<script src="${widgetScriptUrl}" async></script>`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generateEmbedCode());
    setCopied(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Chat Widget
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Configure and generate the embed code for your website chat widget
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Widget Configuration</CardTitle>
                <CardDescription>
                  Customize your chat widget appearance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Widget Logo (Customer Facing)</Label>
                  <ImageCropUpload
                    onImageSelected={handleLogoUpload}
                    currentImageUrl={logoUrl}
                    label=""
                    placeholder="logo"
                    circularCrop={true}
                    size="md"
                    isUploading={isUploading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Widget Title</Label>
                  <Input
                    id="title"
                    type="text"
                    placeholder="e.g. Support Chat"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Default Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger id="language" className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Widget Icon</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {iconOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={icon === option.value ? "default" : "outline"}
                        className="justify-start gap-3 h-auto py-3"
                        onClick={() => setIcon(option.value)}
                      >
                        <option.icon className="h-5 w-5" />
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-semibold">{option.label}</span>
                          <span className="text-xs text-muted-foreground">{option.hint}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm">Use channel logo</Label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, the button shows the channel logo instead of the icon
                    </p>
                  </div>
                  <Switch
                    checked={useChannelLogo}
                    onCheckedChange={(checked) => setUseChannelLogo(checked === true)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Primary Color</Label>
                  <div className="flex gap-2">
                    <input
                      id="color"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-9 w-12 rounded border cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#22c55e"
                      className="h-9 flex-1"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSaveConfig}
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? "Saving..." : "Save Configuration"}
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Security & Limits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold text-sm">
                      🔒 Authorized Website:
                    </span>
                  </div>
                  {workspace?.websiteUrl ? (
                    <div className="mt-2">
                      <p className="text-sm font-mono text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 px-3 py-2 rounded border border-blue-300 dark:border-blue-700">
                        {workspace.websiteUrl}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-amber-600 dark:text-amber-400 font-medium">
                      ⚠️ No Website URL configured. Add URL in{" "}
                      <strong>Settings → Basic → Website URL</strong>
                    </p>
                  )}
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Configure in <strong>Settings → Basic → Website URL</strong>
                  </p>
                </div>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Referrer validation on every request</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Rate limit: 50 messages/hour per IP</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Supports 4 languages: IT, EN, ES, PT</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Embed Code</CardTitle>
                <CardDescription>
                  Copy and paste this code into your website
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="relative">
                    <pre className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg text-sm overflow-x-auto border">
                      <code>{generateEmbedCode()}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyCode}
                      className="absolute top-2 right-2"
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Live Preview - Real widget in-place */}
      {workspace?.id && (
        <ChatWidget
          workspaceId={workspace.id}
          title={title}
          logoUrl={logoUrl ? `${IMG_BASE_URL}${logoUrl}` : undefined}
          useChannelLogo={useChannelLogo}
          icon={icon}
          primaryColor={primaryColor}
          language={language}
          useWindowConfig={false}
          placeholder={translations[language]?.placeholder || "Type a message..."}
        />
      )}
    </PageLayout>
  );
}
