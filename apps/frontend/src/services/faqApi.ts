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
