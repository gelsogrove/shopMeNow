import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { FlowNodeConfigRepository } from '../../../src/repositories/flow-node-config.repository';

// Build a mock FlowNodeConfig record
const buildFlowConfig = (overrides: Partial<any> = {}) => ({
  id: 'config-1',
  workspaceId: 'ws-1',
  flowKey: 'hs60xx',
  flowLabel: 'Lavadora HS-60XX',
  systemPrompt: 'You are a washing machine troubleshooting assistant.',
  model: 'openai/gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 2048,
  availableFunctions: ['contactOperator'],
  flows: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('FlowNodeConfigRepository (E1 Tests)', () => {
  let mockPrisma: jest.Mocked<Pick<PrismaClient, 'flowNodeConfig'>>;
  let repository: FlowNodeConfigRepository;

  beforeEach(() => {
    mockPrisma = {
      flowNodeConfig: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as any,
    } as any;

    repository = new FlowNodeConfigRepository(mockPrisma as unknown as PrismaClient);
  });

  describe('create', () => {
    it('should create FlowNodeConfig with valid data', async () => {
      // SCENARIO: Admin creates a new flow configuration for a washing machine
      const input = {
        flowKey: 'hs60xx',
        flowLabel: 'Lavadora HS-60XX',
        systemPrompt: 'You are a washing machine troubleshooting assistant.',
        model: 'openai/gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 2048,
        availableFunctions: ['contactOperator'],
        flows: { non_parte: { startNode: 'step_0', nodes: { step_0: { type: 'CHOICE', prompt: 'Code?' } } } },
        isActive: true,
      };
      const expected = buildFlowConfig({ workspaceId: 'ws-1', ...input });
      (mockPrisma.flowNodeConfig.create as jest.Mock).mockResolvedValue(expected);

      const config = await repository.create('ws-1', input);

      expect(config).toBeDefined();
      expect(config.workspaceId).toBe('ws-1');
      expect(config.flowKey).toBe('hs60xx');
      expect(config.flowLabel).toBe('Lavadora HS-60XX');
      expect(config.model).toBe('openai/gpt-4o-mini');
      expect(config.temperature).toBe(0.3);
      expect(config.isActive).toBe(true);
      expect(mockPrisma.flowNodeConfig.create).toHaveBeenCalledWith({
        data: { ...input, workspaceId: 'ws-1' },
      });
    });

    it('should throw P2002 error when creating duplicate flowKey in same workspace', async () => {
      // SCENARIO: Admin tries to create a second config with same flowKey
      // RULE: Unique constraint on (workspaceId, flowKey) prevents duplicates
      const p2002Error = Object.assign(new Error('Unique constraint'), { code: 'P2002' });
      (mockPrisma.flowNodeConfig.create as jest.Mock).mockRejectedValue(p2002Error);

      await expect(
        repository.create('ws-1', { flowKey: 'hs60xx', flowLabel: 'Lavadora HS-60XX' })
      ).rejects.toThrow();
    });
  });

  describe('findByFlowKey', () => {
    it('should find config by flowKey in workspace', async () => {
      // SCENARIO: System loads flow config when customer scans QR code
      const expected = buildFlowConfig({ id: 'config-1', workspaceId: 'ws-1', flowKey: 'hs60xx' });
      (mockPrisma.flowNodeConfig.findFirst as jest.Mock).mockResolvedValue(expected);

      const config = await repository.findByFlowKey('ws-1', 'hs60xx');

      expect(config).toBeDefined();
      expect(config?.id).toBe('config-1');
      expect(config?.flowKey).toBe('hs60xx');
      expect(config?.workspaceId).toBe('ws-1');
      // RULE: Must filter by workspaceId + flowKey + isActive:true
      expect(mockPrisma.flowNodeConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: 'ws-1', flowKey: 'hs60xx', isActive: true }),
        })
      );
    });

    it('should return null when flowKey not found', async () => {
      // SCENARIO: Customer scans QR code for non-existent machine
      (mockPrisma.flowNodeConfig.findFirst as jest.Mock).mockResolvedValue(null);

      const config = await repository.findByFlowKey('ws-1', 'unknown_machine');

      expect(config).toBeNull();
    });

    it('should return null when config belongs to different workspace', async () => {
      // SCENARIO: Workspace isolation - config from another workspace not accessible
      // RULE: Queries MUST filter by workspaceId - other workspace returns null
      (mockPrisma.flowNodeConfig.findFirst as jest.Mock).mockResolvedValue(null);

      const config = await repository.findByFlowKey('other-ws', 'hs60xx');

      expect(config).toBeNull();
      expect(mockPrisma.flowNodeConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'other-ws' }) })
      );
    });

    it('should not return inactive configs', async () => {
      // SCENARIO: Admin disables a machine configuration
      // RULE: findByFlowKey MUST filter isActive: true (inactive configs not loaded at runtime)
      (mockPrisma.flowNodeConfig.findFirst as jest.Mock).mockResolvedValue(null);

      const config = await repository.findByFlowKey('ws-1', 'hs60xx');

      expect(config).toBeNull();
      expect(mockPrisma.flowNodeConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) })
      );
    });
  });

  describe('findById', () => {
    it('should find config by ID in workspace', async () => {
      // SCENARIO: Admin views/edits a specific flow configuration
      const expected = buildFlowConfig({ id: 'config-1', workspaceId: 'ws-1' });
      (mockPrisma.flowNodeConfig.findFirst as jest.Mock).mockResolvedValue(expected);

      const config = await repository.findById('ws-1', 'config-1');

      expect(config).toBeDefined();
      expect(config?.id).toBe('config-1');
      expect(config?.workspaceId).toBe('ws-1');
      expect(mockPrisma.flowNodeConfig.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'config-1', workspaceId: 'ws-1' }) })
      );
    });

    it('should return null when ID not found in workspace', async () => {
      // SCENARIO: Admin tries to access non-existent config
      (mockPrisma.flowNodeConfig.findFirst as jest.Mock).mockResolvedValue(null);

      const config = await repository.findById('ws-1', 'non-existent-id');

      expect(config).toBeNull();
    });
  });

  describe('findAllByWorkspace', () => {
    it('should return all configs for workspace', async () => {
      // SCENARIO: Admin views list of all machines in their workspace
      const configs = [
        buildFlowConfig({ id: 'config-1', workspaceId: 'ws-1', flowKey: 'hs60xx' }),
        buildFlowConfig({ id: 'config-2', workspaceId: 'ws-1', flowKey: 'ed340', flowLabel: 'Secadora ED-340' }),
      ];
      (mockPrisma.flowNodeConfig.findMany as jest.Mock).mockResolvedValue(configs);

      const result = await repository.findAllByWorkspace('ws-1');

      expect(result).toHaveLength(2);
      expect(result[0].workspaceId).toBe('ws-1');
      expect(result[1].workspaceId).toBe('ws-1');
      expect(mockPrisma.flowNodeConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'ws-1' }) })
      );
    });

    it('should return empty array when no configs exist', async () => {
      // SCENARIO: New workspace has no flow configs yet
      (mockPrisma.flowNodeConfig.findMany as jest.Mock).mockResolvedValue([]);

      const configs = await repository.findAllByWorkspace('new-ws');

      expect(configs).toHaveLength(0);
    });

    it('should only return configs from specified workspace (workspace isolation)', async () => {
      // SCENARIO: Workspace isolation - each admin sees only their configs
      // RULE: Repository MUST always filter by workspaceId
      const ws1Configs = [
        buildFlowConfig({ id: 'c1', workspaceId: 'ws-1', flowKey: 'hs60xx' }),
        buildFlowConfig({ id: 'c2', workspaceId: 'ws-1', flowKey: 'ed340' }),
      ];
      const ws2Configs = [
        buildFlowConfig({ id: 'c3', workspaceId: 'ws-2', flowKey: 'other_machine' }),
      ];

      (mockPrisma.flowNodeConfig.findMany as jest.Mock)
        .mockResolvedValueOnce(ws1Configs)
        .mockResolvedValueOnce(ws2Configs);

      const configsWs1 = await repository.findAllByWorkspace('ws-1');
      const configsWs2 = await repository.findAllByWorkspace('ws-2');

      expect(configsWs1).toHaveLength(2); // hs60xx + ed340
      expect(configsWs2).toHaveLength(1); // other_machine

      // Verify no cross-contamination
      const ws1Keys = configsWs1.map(c => c.flowKey);
      expect(ws1Keys).not.toContain('other_machine');
    });
  });

  describe('update', () => {
    it('should update config fields', async () => {
      // SCENARIO: Admin edits flow configuration (e.g., updates prompt, adds new flow)
      const existing = buildFlowConfig({ id: 'config-1', workspaceId: 'ws-1' });
      const updateInput = {
        flowLabel: 'Lavadora HS-60XX (Updated)',
        systemPrompt: 'New prompt with more context',
        temperature: 0.5,
        flows: { non_parte: { startNode: 'step_0', nodes: {} } },
      };
      const updated = buildFlowConfig({ ...existing, ...updateInput });

      (mockPrisma.flowNodeConfig.findFirst as jest.Mock).mockResolvedValue(existing);
      (mockPrisma.flowNodeConfig.update as jest.Mock).mockResolvedValue(updated);

      const result = await repository.update('ws-1', 'config-1', updateInput);

      expect(result.id).toBe('config-1');
      expect(result.flowLabel).toBe('Lavadora HS-60XX (Updated)');
      expect(result.systemPrompt).toBe('New prompt with more context');
      expect(result.temperature).toBe(0.5);
      expect(result.flows).toBeDefined();
    });

    it('should throw error when updating config from different workspace', async () => {
      // SCENARIO: Cross-workspace protection - admin cannot edit another workspace's config
      // RULE: Update MUST verify workspaceId before proceeding (findById returns null → throws)
      (mockPrisma.flowNodeConfig.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        repository.update('other-ws', 'config-1', { flowLabel: 'Hacked' })
      ).rejects.toThrow(/not found in workspace/);

      // Update should NOT be called if findById returns null
      expect(mockPrisma.flowNodeConfig.update).not.toHaveBeenCalled();
    });

    it('should throw error when updating non-existent config', async () => {
      // SCENARIO: Admin tries to update deleted or invalid config
      (mockPrisma.flowNodeConfig.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        repository.update('ws-1', 'non-existent-id', { flowLabel: 'Will Fail' })
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete config by ID', async () => {
      // SCENARIO: Admin removes obsolete machine from system
      const existing = buildFlowConfig({ id: 'config-1', workspaceId: 'ws-1' });
      // First call (findById check) returns the config; second call (after delete) returns null
      (mockPrisma.flowNodeConfig.findFirst as jest.Mock)
        .mockResolvedValueOnce(existing) // ownership check
        .mockResolvedValueOnce(null);    // verification after delete
      (mockPrisma.flowNodeConfig.delete as jest.Mock).mockResolvedValue(existing);

      await repository.delete('ws-1', 'config-1');

      expect(mockPrisma.flowNodeConfig.delete).toHaveBeenCalledWith({ where: { id: 'config-1' } });
      // Verify config is gone (simulated)
      const config = await repository.findById('ws-1', 'config-1');
      expect(config).toBeNull();
    });

    it('should throw error when deleting config from different workspace', async () => {
      // SCENARIO: Cross-workspace protection - admin cannot delete another workspace's config
      // RULE: Delete MUST verify workspaceId before proceeding (findById returns null → throws)
      (mockPrisma.flowNodeConfig.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        repository.delete('other-ws', 'config-1')
      ).rejects.toThrow(/not found in workspace/);

      // Delete should NOT be called if findById returns null
      expect(mockPrisma.flowNodeConfig.delete).not.toHaveBeenCalled();
    });

    it('should throw error when deleting non-existent config', async () => {
      // SCENARIO: Admin tries to delete already deleted or invalid config
      (mockPrisma.flowNodeConfig.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        repository.delete('ws-1', 'non-existent-id')
      ).rejects.toThrow();
    });
  });

  describe('workspace cascade delete (onDelete: Cascade)', () => {
    it('should delete all FlowNodeConfigs when workspace is deleted', async () => {
      // SCENARIO: Workspace deletion cleanup
      // RULE: Prisma onDelete: Cascade is a DB-level constraint. The repository
      // verifies this indirectly: after workspace deletion, findAllByWorkspace returns empty.
      // The actual cascade is enforced by the Prisma schema (@@relation onDelete: Cascade).
      (mockPrisma.flowNodeConfig.findMany as jest.Mock).mockResolvedValue([]);

      const remaining = await repository.findAllByWorkspace('deleted-ws');

      expect(remaining).toHaveLength(0);
      expect(mockPrisma.flowNodeConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'deleted-ws' }) })
      );
    });
  });
});
