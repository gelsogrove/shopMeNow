UPDATE platform_config 
SET value = '<!-- eChatbot Widget -->
<script>
  window.eChatbotConfig = {
    "workspaceId": "echatbot-hq-support",
    "apiUrl": "https://echatbot-app-1cba28556df2.herokuapp.com/api/v1",
    "title": "Chat with us",
    "language": "it",
    "primaryColor": "#22c55e"
  };
</script>
<script src="https://www.echatbot.ai/widget.js" async></script>'
WHERE key = 'widgetChatbotCode';
