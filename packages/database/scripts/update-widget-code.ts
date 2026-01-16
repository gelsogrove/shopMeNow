import { prisma } from "../src"

async function updateWidgetCode() {
  const widgetCode = `<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    "workspaceId": "echatbot-hq-support",
    "apiUrl": "https://echatbot-app-1cba28556df2.herokuapp.com/api/v1",
    "title": "Chat with us",
    "language": "it",
    "primaryColor": "#22c55e"
  };
</script>
<script src="https://www.echatbot.ai/widget.js" async></script>`

  const result = await prisma.platformConfig.update({
    where: { key: "widgetChatbotCode" },
    data: {
      value: widgetCode,
      updatedAt: new Date(),
    },
  })

  console.log("✅ Updated widgetChatbotCode with apiUrl parameter")
  console.log(`   Updated record ID: ${result.id}`)
}

updateWidgetCode()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error updating widget code:", error)
    process.exit(1)
  })
