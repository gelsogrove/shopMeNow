import { LinkReplacementService } from '../../../src/application/services/link-replacement.service'
import { prisma } from '@echatbot/database'

// Mock Prisma
jest.mock('@echatbot/database', () => ({
    prisma: {
        customers: {
            findFirst: jest.fn(),
        },
        workspace: {
            findUnique: jest.fn(),
        },
    },
}))

// Mock TokenService
jest.mock('../../../src/application/services/token.service', () => ({
    TokenService: jest.fn().mockImplementation(() => ({
        createRegistrationToken: jest.fn().mockResolvedValue('test-token'),
    })),
}))

// Mock LinkGeneratorService
jest.mock('../../../src/application/services/link-generator.service', () => ({
    linkGeneratorService: {
        generateRegistrationLink: jest.fn().mockResolvedValue('http://test.com/reg'),
        generateShortLink: jest.fn().mockResolvedValue('http://test.com/short'),
        generateCheckoutLink: jest.fn().mockResolvedValue('http://test.com/cart'),
        generateProfileLink: jest.fn().mockResolvedValue('http://test.com/profile'),
    },
}))

// Mock WorkspaceService
jest.mock('../../../src/services/workspace.service', () => ({
    workspaceService: {
        getWorkspaceURLWithRegistration: jest.fn().mockResolvedValue({
            url: 'http://test.com',
            registrationPage: '/registration',
        }),
    },
}))

describe('LinkReplacementService - Registration Token Normalization', () => {
    let linkReplacementService: LinkReplacementService

    beforeEach(() => {
        linkReplacementService = new LinkReplacementService()
        jest.clearAllMocks()
    })

    it('should normalize and replace [LINK_REGISTRATION] (uppercase)', async () => {
        const customerId = 'cust_123'
        const workspaceId = 'ws_123'
        const response = 'Please register here: [LINK_REGISTRATION]'

            // Mock customer NOT active (so link is generated)
            ; (prisma.customers.findFirst as jest.Mock).mockResolvedValue({
                phone: '+3912345678',
                isActive: false,
                registrationStatus: 'NEW',
            })

        const result = await linkReplacementService.replaceTokens(
            { response },
            customerId,
            workspaceId
        )

        expect(result.success).toBe(true)
        expect(result.response).not.toContain('[LINK_REGISTRATION]')
        expect(result.response).toContain('http') // Should contain a generated link
    })

    it('should normalize and replace lowercase varieties', async () => {
        const customerId = 'cust_123'
        const workspaceId = 'ws_123'

        const variations = [
            'Link registrazione: link registrazione',
            'Please use [link registration]',
            'Check this [registration link]',
            'Go to [link registrazione]'
        ]

            ; (prisma.customers.findFirst as jest.Mock).mockResolvedValue({
                phone: '+3912345678',
                isActive: false,
                registrationStatus: 'NEW',
            })

        for (const response of variations) {
            const result = await linkReplacementService.replaceTokens(
                { response },
                customerId,
                workspaceId
            )

            expect(result.success).toBe(true)
            expect(result.response).not.toContain('link registrazione')
            expect(result.response).not.toContain('link registration')
            expect(result.response).not.toContain('registration link')
            expect(result.response).toContain('http')
        }
    })

    it('should handle missing customer data with a fallback public link', async () => {
        const customerId = 'cust_123'
        const workspaceId = 'ws_123'
        const response = 'Register here: [LINK_REGISTRATION]'

            // Mock customer NOT found or missing phone
            ; (prisma.customers.findFirst as jest.Mock).mockResolvedValue(null)

        const result = await linkReplacementService.replaceTokens(
            { response },
            customerId,
            workspaceId
        )

        expect(result.success).toBe(true)
        expect(result.response).not.toContain('[LINK_REGISTRATION]')
        expect(result.response).toContain('/registration') // Fallback link
    })
})
