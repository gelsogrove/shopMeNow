#!/bin/bash

# Update system
yum update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Install Git
yum install -y git

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install PM2 globally
npm install -g pm2

# Create application directory
mkdir -p /home/ec2-user/shopme
chown ec2-user:ec2-user /home/ec2-user/shopme

# Create environment file
cat > /home/ec2-user/shopme/.env << EOF
# Database Configuration
DATABASE_URL="postgresql://${db_username}:${db_password}@${db_host}:5432/${db_name}?schema=public"

# JWT Configuration
JWT_SECRET="a38fa4911b7fdb4aebe1911677792b35599ce990b13b563580e6fad1d2a120ea43e41ba630c9915822fe5bf92449e17a231b99168aa8b5cd18adce3b47b7f3d8"
JWT_EXPIRES_IN="7d"

# OpenRouter Configuration (AI)
OPENROUTER_API_KEY="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"

# SMTP Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="gelsogrove@gmail.com"
SMTP_PASS="skvf saqx fryt xeem"
SMTP_FROM="noreplay@echatbot.ai"

# Google OAuth
GOOGLE_CLIENT_ID="988195920488-drdmtlruo5s47nkk4g8prui6k9mb0pln.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="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"

# Application Configuration
NODE_ENV="production"
PORT="3001"
CORS_ORIGIN="http://localhost:3000"
FRONTEND_URL="http://localhost:3000"
ADMIN_EMAIL="admin@echatbot.ai"
ADMIN_PASSWORD="Venezia44"

# Security
TOKEN_EXPIRATION="15m"
TOKEN_ENCRYPTION_KEY="193b20c983cfeca68ab22230a2097899efbb0574bab7c43e6ec13b86a33edadc"
SKIP_HMAC_VERIFICATION="true"

# WhatsApp Configuration (Optional)
WHATSAPP_TOKEN="your-whatsapp-token"
WHATSAPP_VERIFY_TOKEN="your-verify-token"
EOF

chown ec2-user:ec2-user /home/ec2-user/shopme/.env

# Create deployment script
cat > /home/ec2-user/deploy.sh << 'EOF'
#!/bin/bash
cd /home/ec2-user/shopme

# Clone or update repository
if [ ! -d ".git" ]; then
    git clone https://github.com/your-username/shopME.git .
else
    git pull origin main
fi

# Install dependencies
npm install

# Build applications
npm run build

# Run database migrations
npm run prisma:generate
npm run prisma:migrate

# Start applications with PM2
pm2 delete all 2>/dev/null || true
pm2 start npm --name "shopme-backend" -- run prod:backend
pm2 start npm --name "shopme-scheduler" -- run prod:scheduler

# Save PM2 configuration
pm2 save
pm2 startup
EOF

chmod +x /home/ec2-user/deploy.sh
chown ec2-user:ec2-user /home/ec2-user/deploy.sh

# Install Nginx
yum install -y nginx

# Configure Nginx
cat > /etc/nginx/conf.d/shopme.conf << 'EOF'
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx

# Create systemd service for auto-deployment
cat > /etc/systemd/system/shopme-deploy.service << 'EOF'
[Unit]
Description=ShopME Auto Deploy
After=network.target

[Service]
Type=oneshot
User=ec2-user
ExecStart=/home/ec2-user/deploy.sh
WorkingDirectory=/home/ec2-user/shopme

[Install]
WantedBy=multi-user.target
EOF

systemctl enable shopme-deploy.service

# Log completion
echo "ShopME server setup completed at $(date)" >> /var/log/shopme-setup.log