# 008 - Factory Pattern

## Interface: IWhatsAppProvider
All providers must implement:
```typescript
interface IWhatsAppProvider {
  sendMessage(to: string, content: string): Promise<string>; // Returns processed ID
  verifyWebhook(req: Request): boolean;
  processWebhook(payload: any): Promise<NormalizedMessage[]>;
}
```

## Factory: WhatsAppFactory
Abstracts the selection logic:
```typescript
class WhatsAppFactory {
  static async getProvider(workspaceId: string): Promise<IWhatsAppProvider> {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (workspace.whatsappProvider === 'ultramsg') {
       return new UltraMsgProvider(workspace);
    }
    return new MetaProvider(workspace);
  }
}
```
