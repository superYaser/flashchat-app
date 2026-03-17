/**
 * ============================================================================
 * 快闪群聊App - 群组服务测试
 * ============================================================================
 */

import { GroupService } from '../../src/services/group/group.service';
import { HeatLevel } from '../../../shared/types';

describe('GroupService', () => {
  let groupService: GroupService;

  beforeEach(() => {
    groupService = new GroupService();
  });

  describe('determineHeatLevel', () => {
    it('should return low for 0 messages', () => {
      const level = (groupService as any).determineHeatLevel(0);
      expect(level).toBe('low');
    });

    it('should return low for 2 messages', () => {
      const level = (groupService as any).determineHeatLevel(2);
      expect(level).toBe('low');
    });

    it('should return medium for 3 messages', () => {
      const level = (groupService as any).determineHeatLevel(3);
      expect(level).toBe('medium');
    });

    it('should return medium for 9 messages', () => {
      const level = (groupService as any).determineHeatLevel(9);
      expect(level).toBe('medium');
    });

    it('should return high for 10 messages', () => {
      const level = (groupService as any).determineHeatLevel(10);
      expect(level).toBe('high');
    });

    it('should return high for 29 messages', () => {
      const level = (groupService as any).determineHeatLevel(29);
      expect(level).toBe('high');
    });

    it('should return extreme for 30 messages', () => {
      const level = (groupService as any).determineHeatLevel(30);
      expect(level).toBe('extreme');
    });

    it('should return extreme for 50 messages', () => {
      const level = (groupService as any).determineHeatLevel(50);
      expect(level).toBe('extreme');
    });
  });

  describe('generateRandomPosition', () => {
    it('should generate position within screen bounds', () => {
      const position = (groupService as any).generateRandomPosition();
      expect(position.x).toBeGreaterThanOrEqual(50);
      expect(position.x).toBeLessThanOrEqual(425); // 375 + 50
      expect(position.y).toBeGreaterThanOrEqual(50);
      expect(position.y).toBeLessThanOrEqual(650); // 600 + 50
    });
  });
});
