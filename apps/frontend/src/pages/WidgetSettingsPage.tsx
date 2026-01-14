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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, MessageCircle, X, Send } from "lucide-react";
import { toast } from "@/lib/toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ImageCropUpload } from "@/components/shared/ImageCropUpload";
import { api } from "@/services/api";
import { IMG_BASE_URL } from "@/config";

export default function WidgetSettingsPage() {
  const { workspace, setCurrentWorkspace } = useWorkspace();
  // Use workspace.logoUrl as single source of truth (same logo for channel + widget)
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [title, setTitle] = useState<string>(workspace?.name || "eChatbot");
  const [language, setLanguage] = useState<string>("it");
  const [primaryColor, setPrimaryColor] = useState<string>("#22c55e");
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (workspace) {
      // Use logoUrl as single source (channel logo = widget logo)
      setLogoUrl((workspace as any).logoUrl || "");
      setTitle((workspace as any).widgetTitle || workspace.name || "eChatbot");
      setLanguage((workspace as any).widgetLanguage || "it");
      setPrimaryColor((workspace as any).widgetPrimaryColor || "#22c55e");
    }
  }, [workspace]);

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
      });
      setCurrentWorkspace({
        ...workspace,
        widgetTitle: title,
        widgetLanguage: language,
        widgetPrimaryColor: primaryColor,
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
    const widgetScriptUrl =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/widget.js`
        : "http://localhost:3000/widget.js";
    const apiUrl =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/api/v1`
        : "http://localhost:3001/api/v1";
    const config = {
      workspaceId: workspace?.id || "YOUR_WORKSPACE_ID",
      apiUrl,
      title,
      logoUrl: logoUrl ? `${IMG_BASE_URL}${logoUrl}` : "",
      language,
      primaryColor,
    };
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

      {/* Live Preview - Fixed Widget at bottom-right */}
      {!previewOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={() => setPreviewOpen(true)}
            className="rounded-full w-16 h-16 shadow-lg flex items-center justify-center overflow-hidden transition-transform duration-150 active:scale-90 hover:scale-105"
            style={{ backgroundColor: primaryColor }}
          >
            {logoUrl ? (
              <img
                src={`${IMG_BASE_URL}${logoUrl}`}
                alt="Chat"
                className="w-full h-full object-cover"
              />
            ) : (
              <MessageCircle className="h-7 w-7 text-white" />
            )}
          </button>
        </div>
      )}
      {previewOpen && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border animate-in fade-in slide-in-from-bottom-4 duration-200"
          style={{ width: '420px', height: '650px' }}
        >
          <div
            className="flex items-center justify-between p-5 rounded-t-xl text-white"
            style={{ backgroundColor: primaryColor }}
          >
            <span className="font-semibold text-lg">{title}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewOpen(false)}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="p-5 flex-1 overflow-y-auto" style={{ height: 'calc(100% - 150px)' }}>
            <div className="flex items-start gap-3 mb-4">
              {logoUrl && (
                <img
                  src={`${IMG_BASE_URL}${logoUrl}`}
                  alt="Bot"
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 mt-1"
                />
              )}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 text-base max-w-[70%]">
                {translations[language]?.welcome || "Hello!"}
              </div>
            </div>
          </div>
          <div className="p-5 border-t absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-b-xl">
            <div className="flex gap-3 items-end">
              <textarea
                placeholder={translations[language]?.placeholder || "Type..."}
                className="flex-1 min-h-[44px] max-h-[120px] rounded-3xl px-5 py-3 text-base resize-none border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-0 dark:bg-gray-800 overflow-y-auto scrollbar-hide"
                style={{ 
                  focusRing: primaryColor,
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(Math.max(target.scrollHeight, 44), 120) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    // Would send message in real widget
                  }
                }}
              />
              <Button
                size="sm"
                className="h-12 w-12 p-0 rounded-full flex-shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
            <div className="text-center text-xs text-gray-400 mt-2">
              Powered by{" "}
              <a
                href="https://www.echatbot.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                style={{ color: primaryColor }}
              >
                echatbot.ai
              </a>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
