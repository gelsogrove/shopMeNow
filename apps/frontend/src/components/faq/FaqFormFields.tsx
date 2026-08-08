import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { FAQ } from "@/services/faqApi"

interface FaqFormFieldsProps {
  /** null = Add form, otherwise the FAQ being edited. */
  faq: FAQ | null
  /** Distinct categories already in use, offered as datalist suggestions so
      the same category is spelled consistently across FAQs. */
  existingCategories: string[]
  /** Prefilled category when adding from inside a category folder. */
  defaultCategory: string
}

// Presentational form body shared by the Add and Edit sheets on FAQPage.
// Uncontrolled inputs: the parent reads values via FormData on submit.
export function FaqFormFields({
  faq,
  existingCategories,
  defaultCategory,
}: FaqFormFieldsProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="question">Question</Label>
        <Input
          id="question"
          name="question"
          placeholder="Enter question"
          defaultValue={faq?.question}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="answer">Answer</Label>
        <Textarea
          id="answer"
          name="answer"
          className="min-h-[400px]"
          placeholder="Enter detailed answer"
          defaultValue={faq?.answer}
          required
        />
        <p className="text-xs text-gray-500">
          Provide a clear and detailed answer to the question.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          name="category"
          list="faq-categories"
          placeholder="Enter category (optional)"
          defaultValue={faq?.category ?? defaultCategory}
        />
        <datalist id="faq-categories">
          {existingCategories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        <p className="text-xs text-gray-500">
          Group related FAQs under the same category. The chatbot uses it to
          navigate answers by topic.
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          name="isActive"
          defaultChecked={faq ? faq.isActive : true}
        />
        <Label htmlFor="isActive">Active</Label>
        <p className="text-xs text-gray-500 ml-2">
          Only active FAQs will be visible to customers
        </p>
      </div>
    </div>
  )
}
