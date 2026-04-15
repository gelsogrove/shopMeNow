import { prisma } from '@echatbot/database';
import { FlowNodeConfigRepository } from '../../../src/repositories/flow-node-config.repository';

const repository = new FlowNodeConfigRepository(prisma);

describe('FlowNodeConfigRepository (E1 Tests)', () => {
  let testWorkspaceId: string;
  let testFlowConfig: any;

  beforeAll(async () => {
    // Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Test Flow Workspace',
        slug: `test-flow-${Date.now()}`,
        channelMode: 'FLOW'
      }
    });
    testWorkspaceId = workspace.id;
  });

  afterAll(async () => {
    // Cleanup: delete test workspace (cascade deletes FlowNodeConfigs)
    await prisma.workspace.delete({
      where: { id: testWorkspaceId }
    });
    await prisma.$disconnect();
  });

  afterEach(async () => {
    // Clean up test configs after each test
    await prisma.flowNodeConfig.deleteMany({
      where: { workspaceId: testWorkspaceId }
    });
  });

  describe('create', () => {
    it('should create FlowNodeConfig with valid data', async () => {
      // SCENARIO: Admin creates a new flow configuration for a washing machine
      const data = {
        flowKey: 'hs60xx',
        flowLabel: 'Lavadora HS-60XX',
        systemPrompt: 'You are a washing machine troubleshooting assistant.',
        model: 'openai/gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 2048,
        availableFunctions: ['contactOperator'],
        flows: {
          non_parte: {
            startNode: 'step_0',
            nodes: {
              step_0: {
                type: 'CHOICE',
                prompt: 'What code do you see on the display?'
              }
            }
          }
        },
        isActive: true
      };

      const config = await repository.create(testWorkspaceId, data);

      expect(config).toBeDefined();
      expect(config.workspaceId).toBe(testWorkspaceId);
      expect(config.flowKey).toBe('hs60xx');
      expect(config.flowLabel).toBe('Lavadora HS-60XX');
      expect(config.model).toBe('openai/gpt-4o-mini');
      expect(config.temperature).toBe(0.3);
      expect(config.isActive).toBe(true);
    });

    it('should throw P2002 error when creating duplicate flowKey in same workspace', async () => {
      // SCENARIO: Admin tries to create a second config with same flowKey
      // RULE: Unique constraint on (workspaceId, flowKey) prevents duplicates
      const data = {
        flowKey: 'hs60xx',
        flowLabel: 'Lavadora HS-60XX'
      };

      await repository.create(testWorkspaceId, data);

      // Attempt to create duplicate
      await expect(
        repository.create(testWorkspaceId, data)
      ).rejects.toThrow();
    });
  });

  describe('findByFlowKey', () => {
    beforeEach(async () => {
      // Setup: Create test config
      testFlowConfig = await repository.create(testWorkspaceId, {
        flowKey: 'hs60xx',
        flowLabel: 'Lavadora HS-60XX'
      });
    });

    it('should find config by flowKey in workspace', async () => {
      // SCENARIO: System loads flow config when customer scans QR code
      const config = await repository.findByFlowKey(testWorkspaceId, 'hs60xx');

      expect(config).toBeDefined();
      expect(config?.id).toBe(testFlowConfig.id);
      expect(config?.flowKey).toBe('hs60xx');
      expect(config?.workspaceId).toBe(testWorkspaceId);
    });

    it('should return null when flowKey not found', async () => {
      // SCENARIO: Customer scans QR code for non-existent machine
      const config = await repository.findByFlowKey(testWorkspaceId, 'unknown_machine');

      expect(config).toBeNull();
    });

    it('should return null when config belongs to different workspace', async () => {
      // SCENARIO: Workspace isolation - config from another workspace not accessible
      // RULE: Queries MUST filter by workspaceId
      const otherWorkspace = await prisma.workspace.create({
        data: {
          name: 'Other Workspace',
          slug: `other-${Date.now()}`
        }
      });

      const config = await repository.findByFlowKey(otherWorkspace.id, 'hs60xx');

      expect(config).toBeNull();

      // Cleanup
      await prisma.workspace.delete({ where: { id: otherWorkspace.id } });
    });

    it('should not return inactive configs', async () => {
      // SCENARIO: Admin disables a machine configuration
      await prisma.flowNodeConfig.update({
        where: { id: testFlowConfig.id },
        data: { isActive: false }
      });

      const config = await repository.findByFlowKey(testWorkspaceId, 'hs60xx');

      expect(config).toBeNull();
    });
  });

  describe('findById', () => {
    beforeEach(async () => {
      testFlowConfig = await repository.create(testWorkspaceId, {
        flowKey: 'hs60xx',
        flowLabel: 'Lavadora HS-60XX'
      });
    });

    it('should find config by ID in workspace', async () => {
      // SCENARIO: Admin views/edits a specific flow configuration
      const config = await repository.findById(testWorkspaceId, testFlowConfig.id);

      expect(config).toBeDefined();
      expect(config?.id).toBe(testFlowConfig.id);
      expect(config?.workspaceId).toBe(testWorkspaceId);
    });

    it('should return null when ID not found in workspace', async () => {
      // SCENARIO: Admin tries to access non-existent config
      const fakeId = 'non-existent-id';
      const config = await repository.findById(testWorkspaceId, fakeId);

      expect(config).toBeNull();
    });
  });

  describe('findAllByWorkspace', () => {
    beforeEach(async () => {
      // Setup: Create multiple configs
      await repository.create(testWorkspaceId, {
        flowKey: 'hs60xx',
        flowLabel: 'Lavadora HS-60XX'
      });
      await repository.create(testWorkspaceId, {
        flowKey: 'ed340',
        flowLabel: 'Secadora ED-340'
      });
    });

    it('should return all configs for workspace', async () => {
      // SCENARIO: Admin views list of all machines in their workspace
      const configs = await repository.findAllByWorkspace(testWorkspaceId);

      expect(configs).toHaveLength(2);
      expect(configs[0].workspaceId).toBe(testWorkspaceId);
      expect(configs[1].workspaceId).toBe(testWorkspaceId);
    });

    it('should return empty array when no configs exist', async () => {
      // SCENARIO: New workspace has no flow configs yet
      const newWorkspace = await prisma.workspace.create({
        data: {
          name: 'Empty Workspace',
          slug: `empty-${Date.now()}`
        }
      });

      const configs = await repository.findAllByWorkspace(newWorkspace.id);

      expect(configs).toHaveLength(0);

      // Cleanup
      await prisma.workspace.delete({ where: { id: newWorkspace.id } });
    });

    it('should only return configs from specified workspace (workspace isolation)', async () => {
      // SCENARIO: Workspace isolation - each admin sees only their configs
      // RULE: Repository MUST always filter by workspaceId
      const otherWorkspace = await prisma.workspace.create({
        data: {
          name: 'Other Workspace',
          slug: `other-${Date.now()}`
        }
      });

      await repository.create(otherWorkspace.id, {
        flowKey: 'other_machine',
        flowLabel: 'Other Machine'
      });

      const configsWorkspace1 = await repository.findAllByWorkspace(testWorkspaceId);
      const configsWorkspace2 = await repository.findAllByWorkspace(otherWorkspace.id);

      expect(configsWorkspace1).toHaveLength(2); // hs60xx + ed340
      expect(configsWorkspace2).toHaveLength(1); // other_machine

      // Verify no cross-contamination
      const workspace1Keys = configsWorkspace1.map(c => c.flowKey);
      expect(workspace1Keys).not.toContain('other_machine');

      // Cleanup
      await prisma.workspace.delete({ where: { id: otherWorkspace.id } });
    });
  });

  describe('update', () => {
    beforeEach(async () => {
      testFlowConfig = await repository.create(testWorkspaceId, {
        flowKey: 'hs60xx',
        flowLabel: 'Lavadora HS-60XX',
        systemPrompt: 'Old prompt',
        temperature: 0.3
      });
    });

    it('should update config fields', async () => {
      // SCENARIO: Admin edits flow configuration (e.g., updates prompt, adds new flow)
      const updated = await repository.update(testWorkspaceId, testFlowConfig.id, {
        flowLabel: 'Lavadora HS-60XX (Updated)',
        systemPrompt: 'New prompt with more context',
        temperature: 0.5,
        flows: {
          non_parte: {
            startNode: 'step_0',
            nodes: {}
          }
        }
      });

      expect(updated.id).toBe(testFlowConfig.id);
      expect(updated.flowLabel).toBe('Lavadora HS-60XX (Updated)');
      expect(updated.systemPrompt).toBe('New prompt with more context');
      expect(updated.temperature).toBe(0.5);
      expect(updated.flows).toBeDefined();
    });

    it('should throw error when updating config from different workspace', async () => {
      // SCENARIO: Cross-workspace protection - admin cannot edit another workspace's config
      // RULE: Update MUST verify workspaceId before proceeding
      const otherWorkspace = await prisma.workspace.create({
        data: {
          name: 'Other Workspace',
          slug: `other-${Date.now()}`
        }
      });

      await expect(
        repository.update(otherWorkspace.id, testFlowConfig.id, {
          flowLabel: 'Hacked'
        })
      ).rejects.toThrow(/not found in workspace/);

      // Cleanup
      await prisma.workspace.delete({ where: { id: otherWorkspace.id } });
    });

    it('should throw error when updating non-existent config', async () => {
      // SCENARIO: Admin tries to update deleted or invalid config
      const fakeId = 'non-existent-id';

      await expect(
        repository.update(testWorkspaceId, fakeId, {
          flowLabel: 'Will Fail'
        })
      ).rejects.toThrow();
    });
  });

  describe('delete', () => {
    beforeEach(async () => {
      testFlowConfig = await repository.create(testWorkspaceId, {
        flowKey: 'hs60xx',
        flowLabel: 'Lavadora HS-60XX'
      });
    });

    it('should delete config by ID', async () => {
      // SCENARIO: Admin removes obsolete machine from system
      await repository.delete(testWorkspaceId, testFlowConfig.id);

      const config = await repository.findById(testWorkspaceId, testFlowConfig.id);
      expect(config).toBeNull();
    });

    it('should throw error when deleting config from different workspace', async () => {
      // SCENARIO: Cross-workspace protection - admin cannot delete another workspace's config
      // RULE: Delete MUST verify workspaceId before proceeding
      const otherWorkspace = await prisma.workspace.create({
        data: {
          name: 'Other Workspace',
          slug: `other-${Date.now()}`
        }
      });

      await expect(
        repository.delete(otherWorkspace.id, testFlowConfig.id)
      ).rejects.toThrow(/not found in workspace/);

      // Verify config still exists
      const config = await repository.findById(testWorkspaceId, testFlowConfig.id);
      expect(config).toBeDefined();

      // Cleanup
      await prisma.workspace.delete({ where: { id: otherWorkspace.id } });
    });

    it('should throw error when deleting non-existent config', async () => {
      // SCENARIO: Admin tries to delete already deleted or invalid config
      const fakeId = 'non-existent-id';

      await expect(
        repository.delete(testWorkspaceId, fakeId)
      ).rejects.toThrow();
    });
  });

  describe('workspace cascade delete (onDelete: Cascade)', () => {
    it('should delete all FlowNodeConfigs when workspace is deleted', async () => {
      // SCENARIO: Workspace deletion cleanup
      // RULE: Prisma onDelete: Cascade ensures orphaned configs are removed
      const tempWorkspace = await prisma.workspace.create({
        data: {
          name: 'Temp Workspace',
          slug: `temp-${Date.now()}`
        }
      });

      const config1 = await repository.create(tempWorkspace.id, {
        flowKey: 'machine1',
        flowLabel: 'Machine 1'
      });
      const config2 = await repository.create(tempWorkspace.id, {
        flowKey: 'machine2',
        flowLabel: 'Machine 2'
      });

      // Delete workspace
      await prisma.workspace.delete({ where: { id: tempWorkspace.id } });

      // Verify configs are gone
      const remainingConfigs = await prisma.flowNodeConfig.findMany({
        where: { id: { in: [config1.id, config2.id] } }
      });

      expect(remainingConfigs).toHaveLength(0);
    });
  });
});
