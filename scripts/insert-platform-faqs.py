#!/usr/bin/env python3
"""
Script to insert Platform Guide FAQs into eChatbot HQ Support workspace.
Run with: python3 scripts/insert-platform-faqs.py
"""

import subprocess
import sys
import os

WORKSPACE_ID = "echatbot-hq-support"
APP = "echatbot-app"

FAQS = [
    {
        "category": "Platform Guide",
        "order": 10,
        "question": "How do I connect my WhatsApp number?",
        "answer": (
            "Go to **Menu > Settings > WhatsApp Channel**.\n\n"
            "Here you can:\n"
            "- Choose your WhatsApp provider (**Meta** official API or **UltraMsg**)\n"
            "- Enter your **phone number**, instance ID, and API token\n"
            "- Set the **webhook URL** and verify token\n"
            "- Enable or disable the channel with the toggle switch\n\n"
            "Tip: The Meta official API requires approval from Meta Business. "
            "UltraMsg works immediately but has lower throughput."
        ),
        "keywords": ["whatsapp", "channel", "setup", "connect", "number", "settings"],
    },
    {
        "category": "Platform Guide",
        "order": 11,
        "question": "How do I enable or disable the WhatsApp channel?",
        "answer": (
            "Go to **Menu > Settings > WhatsApp Channel**.\n\n"
            "Toggle the **Channel Active** switch at the top of the page.\n"
            "- Active: chatbot responds to incoming messages\n"
            "- Disabled: messages are received but NOT answered (the queue still logs them)\n\n"
            "Useful when you want to pause the bot temporarily without losing messages."
        ),
        "keywords": ["whatsapp", "enable", "disable", "channel", "active", "pause"],
    },
    {
        "category": "Platform Guide",
        "order": 20,
        "question": "How do I change the chatbot name and tone of voice?",
        "answer": (
            "Go to **Menu > Settings > AI Personality**.\n\n"
            "Here you can configure:\n"
            "- **Chatbot Name** -- the name shown to customers (e.g. Sofia, Alex)\n"
            "- **Identity Response** -- what the bot says when asked 'Who are you?'\n"
            "- **Tone of Voice** -- choose FORMAL, FRIENDLY, or PROFESSIONAL\n"
            "- **Welcome Message** -- the first message sent to new customers\n"
            "- **Custom AI Rules** -- free-text instructions (e.g. 'Always greet by name', 'Use bullet points')\n\n"
            "Changes take effect on the next incoming message - no restart needed."
        ),
        "keywords": ["personality", "tone", "name", "chatbot", "identity", "ai", "settings"],
    },
    {
        "category": "Platform Guide",
        "order": 30,
        "question": "How do I create a push campaign?",
        "answer": (
            "Go to **Menu > Campaigns** (icon near your user avatar in the top bar).\n\n"
            "Steps:\n"
            "1. Click **New Campaign**\n"
            "2. Write the message you want to send\n"
            "3. Choose your **target audience** (all customers, by tag, by language, etc.)\n"
            "4. Set the **scheduled date and time** or send immediately\n"
            "5. Click **Send** or **Schedule**\n\n"
            "After sending you can monitor delivery rate, open rate, and responses "
            "directly in the campaign detail page."
        ),
        "keywords": ["campaign", "push", "notification", "send", "schedule", "marketing", "broadcast"],
    },
    {
        "category": "Platform Guide",
        "order": 40,
        "question": "How do I add tags to a customer?",
        "answer": (
            "Go to **Menu > Customers**, find the customer and click on their name to open the profile.\n\n"
            "In the customer detail panel:\n"
            "- Click **Add Tag**\n"
            "- Type the tag name (e.g. VIP, trial, italian) and confirm\n"
            "- Tags are used to **filter campaigns** and **segment your audience**\n\n"
            "You can also add tags during a live chat from the Chat panel "
            "by clicking the customer name at the top."
        ),
        "keywords": ["tag", "label", "customer", "segment", "clients", "audience", "filter"],
    },
    {
        "category": "Platform Guide",
        "order": 50,
        "question": "How do I see conversations waiting for human support?",
        "answer": (
            "Go to **Menu > Queue**.\n\n"
            "The Queue shows all conversations where a customer has requested human assistance "
            "(or where the chatbot has escalated to an operator).\n\n"
            "From here you can:\n"
            "- See the **waiting time** for each conversation\n"
            "- Click a chat to **open it and reply**\n"
            "- **Reassign** chats to a team member\n"
            "- Mark conversations as **resolved**\n\n"
            "You can configure email notifications when new escalations arrive: "
            "go to **Menu > Settings > Human Support**."
        ),
        "keywords": ["queue", "support", "human", "operator", "escalation", "handoff", "waiting"],
    },
    {
        "category": "Platform Guide",
        "order": 60,
        "question": "How do I block a customer?",
        "answer": (
            "Go to **Menu > Customers**, find the customer and open their profile.\n\n"
            "Click the **Block** button (or the three-dot menu > Block).\n"
            "- A blocked customer can no longer send messages that the chatbot processes\n"
            "- Their existing conversations remain visible in Chat history\n"
            "- You can **unblock** them at any time from the same profile\n\n"
            "Blocking applies to that specific phone number / contact only."
        ),
        "keywords": ["block", "ban", "customer", "prevent", "stop", "spam"],
    },
    {
        "category": "Platform Guide",
        "order": 70,
        "question": "What are Custom Tools (Calling Functions) and how do I create one?",
        "answer": (
            "Go to **Menu > Settings > Custom Tools**.\n\n"
            "Custom Tools allow the chatbot to call your **external APIs** (webhooks) to fetch or send "
            "real-time data -- for example: check stock, look up order status, or trigger an action in your CRM.\n\n"
            "To create a new tool:\n"
            "1. Click **Add Tool**\n"
            "2. Enter the **name** the AI will use to identify it (e.g. check_stock)\n"
            "3. Enter the **webhook URL** of your API endpoint\n"
            "4. Define the **parameters** the AI will collect from the conversation and pass to the API\n"
            "5. Set the **HTTP method** (GET or POST)\n"
            "6. Save\n\n"
            "The chatbot will automatically call this function when it needs that information."
        ),
        "keywords": ["calling functions", "custom tools", "webhook", "api", "integration", "function", "external"],
    },
    {
        "category": "Platform Guide",
        "order": 80,
        "question": "How do I configure human support and operator escalation?",
        "answer": (
            "Go to **Menu > Settings > Human Support**.\n\n"
            "Here you can:\n"
            "- **Enable/disable** human support for your workspace\n"
            "- Set the **escalation message** shown to customers when an operator is assigned "
            "(supports variables like {{nameUser}}, {{agentName}}, {{agentPhone}})\n"
            "- Choose **contact method**: EMAIL or WHATSAPP for operator notifications\n"
            "- Write custom **escalation rules** (what situations should trigger escalation)\n\n"
            "Operators receive a notification and can reply from **Menu > Queue** "
            "or via the Operator Dashboard link."
        ),
        "keywords": ["human support", "operator", "escalation", "handoff", "agent", "contact", "settings"],
    },
    {
        "category": "Platform Guide",
        "order": 90,
        "question": "Where can I see stats and analytics for my chatbot?",
        "answer": (
            "Go to **Menu > Analytics**.\n\n"
            "The Analytics dashboard shows:\n"
            "- Total conversations and daily trends\n"
            "- Messages sent/received\n"
            "- Chatbot vs human response breakdown\n"
            "- Top FAQ answers used\n"
            "- Language distribution of customers\n"
            "- Campaign performance (delivery, read rate)\n\n"
            "You can filter by **date range** and export data for BI tools."
        ),
        "keywords": ["analytics", "stats", "reports", "performance", "dashboard", "metrics"],
    },
    {
        "category": "Platform Guide",
        "order": 100,
        "question": "How do I invite a team member to my workspace?",
        "answer": (
            "Go to **Menu > Team Collaboration** (accessible from the top navigation bar).\n\n"
            "Steps:\n"
            "1. Click **Invite Member**\n"
            "2. Enter their **email address**\n"
            "3. Choose their **role**: SUPER_ADMIN, ADMIN, or MEMBER\n"
            "4. Click **Send Invitation**\n\n"
            "They will receive an email with a registration link. Once they accept, "
            "they can access your workspace with the permissions you assigned.\n\n"
            "Roles:\n"
            "- **SUPER_ADMIN** -- full access including billing\n"
            "- **ADMIN** -- full access except billing\n"
            "- **MEMBER** -- read/respond only"
        ),
        "keywords": ["team", "invite", "member", "collaborate", "user", "role", "permission"],
    },
    {
        "category": "Platform Guide",
        "order": 110,
        "question": "How do I add the chat widget to my website?",
        "answer": (
            "Go to **Menu > Settings > Website Widget**.\n\n"
            "Here you can:\n"
            "- Set the **widget title**, subtitle, and colors to match your brand\n"
            "- Choose **position** (bottom-right or bottom-left)\n"
            "- Enable or disable the widget channel\n\n"
            "To embed it on your website:\n"
            "1. Scroll down to **Widget Code**\n"
            "2. Copy the JavaScript snippet\n"
            "3. Paste it just before the closing </body> tag of your website\n\n"
            "The widget connects directly to the same chatbot and customer database as WhatsApp."
        ),
        "keywords": ["widget", "embed", "website", "code", "snippet", "html", "web"],
    },
    {
        "category": "Platform Guide",
        "order": 120,
        "question": "Where do I see my credit balance and how do I top up?",
        "answer": (
            "Go to **Menu > Billing**.\n\n"
            "Here you can:\n"
            "- See your **current credit balance** and consumption history\n"
            "- View the **current plan** (Starter, Premium, Enterprise)\n"
            "- **Add credits** via credit card or PayPal\n"
            "- Download **monthly invoices**\n\n"
            "Credits are consumed per message sent/received. "
            "You will receive an email alert when your balance is running low."
        ),
        "keywords": ["billing", "credits", "balance", "plan", "invoice", "payment", "top up"],
    },
    {
        "category": "Platform Guide",
        "order": 130,
        "question": "How do I update my business information?",
        "answer": (
            "Go to **Menu > Settings > Business Config**.\n\n"
            "Here you can update:\n"
            "- **Business name**, description, and website URL\n"
            "- **Notification email** for alerts\n"
            "- **Currency** and **default language**\n\n"
            "These details are used by the chatbot when customers ask about your business."
        ),
        "keywords": ["business", "info", "settings", "name", "website", "currency", "language", "config"],
    },
    {
        "category": "Platform Guide",
        "order": 140,
        "question": "How do I restrict which domains can use my widget?",
        "answer": (
            "Go to **Menu > Settings > Security**.\n\n"
            "In the **Allowed Domains** field, enter your website domains (one per line, "
            "e.g. https://myshop.com).\n\n"
            "- Only those domains will be allowed to load your widget\n"
            "- Requests from unlisted domains will be blocked (prevents unauthorized embedding)\n"
            "- Leave empty to allow all domains (not recommended for production)\n\n"
            "Also here you can manage **2FA enforcement** for your team members."
        ),
        "keywords": ["security", "domain", "widget", "allowed", "restrict", "cors", "2fa"],
    },
]


def escape_sql_string(s):
    """Escape single quotes for PostgreSQL."""
    return s.replace("'", "''")


def build_sql():
    lines = ["INSERT INTO faqs (id, \"workspaceId\", question, answer, keywords, category, \"order\", \"isActive\", \"updatedAt\") VALUES"]
    rows = []
    for faq in FAQS:
        q = escape_sql_string(faq["question"])
        a = escape_sql_string(faq["answer"])
        kw = "{" + ",".join(faq["keywords"]) + "}"
        cat = escape_sql_string(faq["category"])
        row = (
            f"  (gen_random_uuid()::text, '{WORKSPACE_ID}', '{q}', '{a}', "
            f"'{kw}', '{cat}', {faq['order']}, true, CURRENT_TIMESTAMP)"
        )
        rows.append(row)
    lines.append(",\n".join(rows) + ";")
    return "\n".join(lines)


def run_sql(sql):
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)
    proc = subprocess.run(
        ["psql", db_url],
        input=sql,
        capture_output=True,
        text=True
    )
    print("STDOUT:", proc.stdout)
    if proc.stderr:
        print("STDERR:", proc.stderr)
    return proc.returncode


if __name__ == "__main__":
    # First check if already inserted
    check_sql = "SELECT COUNT(*) FROM faqs WHERE category = 'Platform Guide' AND \"workspaceId\" = 'echatbot-hq-support';"
    proc = subprocess.run(
        ["heroku", "pg:psql", "--app", APP],
        input=check_sql,
        capture_output=True,
        text=True
    )
    print("Current Platform Guide FAQ count:", proc.stdout)

    sql = build_sql()

    # Write SQL to temp file for inspection
    with open("/tmp/platform-faqs.sql", "w") as f:
        f.write(sql)
    print("SQL written to /tmp/platform-faqs.sql")

    print(f"\nInserting {len(FAQS)} Platform Guide FAQs into Heroku...")
    rc = run_sql(sql)
    if rc == 0:
        print("SUCCESS!")
        # Verify
        run_sql("SELECT COUNT(*) as total FROM faqs WHERE category = 'Platform Guide' AND \"workspaceId\" = 'echatbot-hq-support';")
    else:
        print("FAILED with exit code:", rc)
        sys.exit(1)
