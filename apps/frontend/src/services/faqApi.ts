import { logger } from "@/lib/logger"
import { api } from "./api"

export interface FAQ {
  id: string
  question: string
  answer: string
  isActive: boolean
  workspaceId: string
  createdAt: string
  updatedAt: string
}

export interface CreateFAQData {
  question: string
  answer: string
  isActive?: boolean
}

export interface UpdateFAQData {
  question?: string
  answer?: string
  isActive?: boolean
}

// Mock data for FAQs when API fails
const mockFAQs: FAQ[] = [
  {
    id: "mock-faq-1",
    question: "How can I modify my order?",
    answer:
      'You can modify your order by accessing the "My Orders" section in your account, selecting the order you want to modify and clicking on "Edit Order".',
    isActive: true,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-faq-2",
    question: "What payment methods do you accept?",
    answer:
      "We accept payments via credit cards (Visa, Mastercard, American Express), PayPal and bank transfer. Payment details are visible at checkout.",
    isActive: true,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-faq-3",
    question: "How long does delivery take?",
    answer:
      "Delivery times vary from 2 to 5 business days, depending on your location. Exact details are provided at checkout.",
    isActive: false,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-faq-4",
    question: "How much does it cost to send a push notification?",
    answer:
      "Push notifications cost $1.00 per message. This is a simple and transparent pricing model that allows you to reach your customers directly with targeted messages and promotions.",
    isActive: true,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-faq-5",
    question: "Can I schedule push notifications?",
    answer:
      "Yes! You can schedule push notifications to be sent at specific times and dates. This allows you to plan your campaigns in advance and reach customers when they are most likely to engage. You can also set up recurring campaigns for regular reminders and promotions.",
    isActive: true,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-faq-6",
    question: "Can I use AI to understand what message to send in a push?",
    answer:
      "With the Enterprise version, we can analyze your data together to determine the best campaign strategy. Our AI analyzes customer behavior, preferences, and engagement patterns to recommend optimal message content, timing, and target segments for maximum impact.",
    isActive: true,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-faq-7",
    question: "Where can I get product availability information?",
    answer:
      "With the Enterprise version, we can connect to external services to retrieve real-time product availability information. This integration allows us to keep your campaigns accurate by showing up-to-date stock levels, delivery dates, and inventory status directly from your systems.",
    isActive: true,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-faq-8",
    question: "How many people can collaborate on campaigns?",
    answer:
      "The workspace is shared with users who have received an invitation. All team members with workspace access can view and collaborate on campaigns together. You can invite as many team members as you need, and everyone will have visibility into campaign performance and customer engagement.",
    isActive: true,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-faq-9",
    question: "Can I block a user from receiving campaigns?",
    answer:
      "Yes, you can block users if needed. If a customer sends spam or requests to stop receiving messages, you can block them. Blocked users will not receive any further campaigns or communications from your business.",
    isActive: true,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-faq-10",
    question: "Can I intervene in the chat during a campaign?",
    answer:
      "Yes, absolutely! You can take over the chat at any moment and intervene directly. Simply turn off the chatbot and start conversing with the customer personally. This allows you to provide personal support, handle special requests, or resolve issues in real-time.",
    isActive: true,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-faq-11",
    question: "Are there statistics for campaigns?",
    answer:
      "Yes! We provide detailed statistics for every channel. You can view:\n✅ Message delivery rates\n✅ Customer engagement metrics\n✅ Click-through rates\n✅ Conversion data\n✅ Performance by channel (WhatsApp, Widget, etc.)\n✅ Customer response analysis\n\nUse these insights to optimize your campaigns and improve results.",
    isActive: true,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mock-faq-12",
    question: "Can I use the widget for web and WhatsApp at the same time?",
    answer:
      "Yes! That's exactly the purpose of eChatbot. You can deploy the widget on your website and also maintain your WhatsApp business number, using both channels simultaneously. Customers can choose their preferred way to communicate, and all conversations are unified in your workspace for a seamless experience.",
    isActive: true,
    workspaceId: "mock-workspace",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

/**
 * Gets all FAQs for a workspace
 */
export const getFAQs = async (workspaceId: string): Promise<FAQ[]> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/faqs`)
    return response.data
  } catch (error) {
    logger.error("Error getting FAQs:", error)
    // For development/testing, return mock FAQs
    logger.warn("Returning mock FAQs data")
    return mockFAQs
  }
}

/**
 * Gets a specific FAQ by ID
 */
export const getFAQById = async (
  workspaceId: string,
  id: string
): Promise<FAQ> => {
  try {
    const response = await api.get(`/workspaces/${workspaceId}/faqs/${id}`)
    return response.data
  } catch (error) {
    logger.error("Error getting FAQ:", error)
    const mockFaq = mockFAQs.find((faq) => faq.id === id)
    if (mockFaq) return mockFaq
    throw error
  }
}

/**
 * Creates a new FAQ
 */
export const createFAQ = async (
  workspaceId: string,
  data: CreateFAQData
): Promise<FAQ> => {
  try {
    const response = await api.post(`/workspaces/${workspaceId}/faqs`, data)
    return response.data
  } catch (error) {
    logger.error("Error creating FAQ:", error)
    // For development/testing, return a mock FAQ
    logger.warn("Returning mock created FAQ data")
    const newFaq: FAQ = {
      id: `mock-faq-${Date.now()}`,
      question: data.question,
      answer: data.answer,
      isActive: data.isActive ?? true,
      workspaceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockFAQs.push(newFaq)
    return newFaq
  }
}

/**
 * Updates an existing FAQ
 */
export const updateFAQ = async (
  workspaceId: string,
  id: string,
  data: UpdateFAQData
): Promise<FAQ> => {
  try {
    const response = await api.put(
      `/workspaces/${workspaceId}/faqs/${id}`,
      data
    )
    return response.data
  } catch (error) {
    logger.error("Error updating FAQ:", error)
    // For development/testing, update a mock FAQ
    logger.warn("Updating mock FAQ data")
    const index = mockFAQs.findIndex((faq) => faq.id === id)
    if (index !== -1) {
      mockFAQs[index] = {
        ...mockFAQs[index],
        ...data,
        updatedAt: new Date().toISOString(),
      }
      return mockFAQs[index]
    }
    throw error
  }
}

/**
 * Deletes a FAQ
 */
export const deleteFAQ = async (
  workspaceId: string,
  id: string
): Promise<void> => {
  try {
    await api.delete(`/workspaces/${workspaceId}/faqs/${id}`)
  } catch (error) {
    logger.error("Error deleting FAQ:", error)
    // For development/testing, delete a mock FAQ
    logger.warn("Deleting mock FAQ data")
    const index = mockFAQs.findIndex((faq) => faq.id === id)
    if (index !== -1) {
      mockFAQs.splice(index, 1)
    }
    throw error
  }
}

export const faqApi = {
  getFAQs,
  getFAQById,
  createFAQ,
  updateFAQ,
  deleteFAQ,
}
