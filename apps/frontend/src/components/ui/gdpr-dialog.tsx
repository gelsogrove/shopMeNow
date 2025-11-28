import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface GDPRDialogProps {
  children: React.ReactNode
}

export function GDPRDialog({ children }: GDPRDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Privacy Policy & GDPR Terms</DialogTitle>
          <DialogDescription>
            Last updated: {new Date().toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 text-sm">
          <section>
            <h3 className="font-semibold mb-2">1. Introduction</h3>
            <p>
              This Privacy Policy explains how we collect, use, and protect your
              personal information in accordance with GDPR regulations.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">2. Data Collection</h3>
            <p>We collect and process the following personal data:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Name and contact information</li>
              <li>Account credentials</li>
              <li>Usage data and preferences</li>
              <li>Device and browser information</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-2">3. Data Usage</h3>
            <p>Your data is used for:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Account management</li>
              <li>Service provision</li>
              <li>Communication</li>
              <li>Security and fraud prevention</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-2">4. Your Rights</h3>
            <p>Under GDPR, you have the following rights:</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Right to access your data</li>
              <li>Right to rectification</li>
              <li>Right to erasure</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-2">5. Data Security</h3>
            <p>
              We implement appropriate technical and organizational measures to
              ensure data security, including encryption, access controls, and
              regular security assessments.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">6. Contact Information</h3>
            <p>
              For any privacy-related inquiries, please contact our Data
              Protection Officer at: privacy@example.com
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
