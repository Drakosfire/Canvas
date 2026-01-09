/**
 * Character Data Reference Tests
 * Tests for the 'character' data reference type in Canvas
 */

import type { ComponentDataSource, ComponentDataReference, ComponentInstance } from '../types/canvas.types';
import { createDefaultDataResolver } from '../types/adapters.types';

describe('Character data reference type', () => {
    const resolver = createDefaultDataResolver();

    describe('resolveDataReference with character type', () => {
        it('should resolve simple character path', () => {
            const dataSources: ComponentDataSource[] = [{
                id: 'char-1',
                type: 'character',
                payload: { name: 'Marcus', level: 5 },
                updatedAt: new Date().toISOString(),
            }];

            const name = resolver.resolveDataReference<string>(
                dataSources,
                { type: 'character', path: 'name' }
            );

            expect(name).toBe('Marcus');
        });

        it('should resolve numeric character property', () => {
            const dataSources: ComponentDataSource[] = [{
                id: 'char-1',
                type: 'character',
                payload: { name: 'Marcus', level: 5 },
                updatedAt: new Date().toISOString(),
            }];

            const level = resolver.resolveDataReference<number>(
                dataSources,
                { type: 'character', path: 'level' }
            );

            expect(level).toBe(5);
        });

        it('should resolve nested character path', () => {
            const dataSources: ComponentDataSource[] = [{
                id: 'char-1',
                type: 'character',
                payload: {
                    name: 'Marcus',
                    dnd5eData: {
                        abilityScores: { strength: 16, dexterity: 14 }
                    }
                },
                updatedAt: new Date().toISOString(),
            }];

            const abilityScores = resolver.resolveDataReference<{ strength: number; dexterity: number }>(
                dataSources,
                { type: 'character', path: 'dnd5eData.abilityScores' }
            );

            expect(abilityScores?.strength).toBe(16);
            expect(abilityScores?.dexterity).toBe(14);
        });

        it('should resolve deeply nested character path', () => {
            const dataSources: ComponentDataSource[] = [{
                id: 'char-1',
                type: 'character',
                payload: {
                    name: 'Marcus',
                    dnd5eData: {
                        combat: {
                            savingThrows: {
                                strength: { proficient: true, modifier: 5 }
                            }
                        }
                    }
                },
                updatedAt: new Date().toISOString(),
            }];

            const strSave = resolver.resolveDataReference<{ proficient: boolean; modifier: number }>(
                dataSources,
                { type: 'character', path: 'dnd5eData.combat.savingThrows.strength' }
            );

            expect(strSave?.proficient).toBe(true);
            expect(strSave?.modifier).toBe(5);
        });

        it('should return undefined for missing character path', () => {
            const dataSources: ComponentDataSource[] = [{
                id: 'char-1',
                type: 'character',
                payload: { name: 'Marcus' },
                updatedAt: new Date().toISOString(),
            }];

            const missing = resolver.resolveDataReference(
                dataSources,
                { type: 'character', path: 'nonexistent' }
            );

            expect(missing).toBeUndefined();
        });

        it('should return undefined for missing nested path', () => {
            const dataSources: ComponentDataSource[] = [{
                id: 'char-1',
                type: 'character',
                payload: { name: 'Marcus' },
                updatedAt: new Date().toISOString(),
            }];

            const missing = resolver.resolveDataReference(
                dataSources,
                { type: 'character', path: 'dnd5eData.abilityScores' }
            );

            expect(missing).toBeUndefined();
        });

        it('should return undefined when no character data source exists', () => {
            const dataSources: ComponentDataSource[] = [{
                id: 'statblock-1',
                type: 'statblock',
                payload: { name: 'Goblin' },
                updatedAt: new Date().toISOString(),
            }];

            const missing = resolver.resolveDataReference(
                dataSources,
                { type: 'character', path: 'name' }
            );

            expect(missing).toBeUndefined();
        });
    });

    describe('getPrimarySource with character type', () => {
        it('should get character data source', () => {
            const characterPayload = { name: 'Marcus', level: 5 };
            const dataSources: ComponentDataSource[] = [{
                id: 'char-1',
                type: 'character',
                payload: characterPayload,
                updatedAt: new Date().toISOString(),
            }];

            const result = resolver.getPrimarySource<typeof characterPayload>(dataSources, 'character');

            expect(result).toEqual(characterPayload);
        });

        it('should return undefined when no character source', () => {
            const dataSources: ComponentDataSource[] = [{
                id: 'statblock-1',
                type: 'statblock',
                payload: { name: 'Goblin' },
                updatedAt: new Date().toISOString(),
            }];

            const result = resolver.getPrimarySource(dataSources, 'character');

            expect(result).toBeUndefined();
        });
    });

    describe('type safety', () => {
        it('should compile ComponentDataReference with character type', () => {
            // Type check - this should compile without error
            const characterRef: ComponentDataReference = {
                type: 'character',
                path: 'dnd5eData.abilityScores',
            };

            expect(characterRef.type).toBe('character');
            expect(characterRef.path).toBe('dnd5eData.abilityScores');
        });

        it('should compile ComponentInstance with character data ref', () => {
            // Type check - this should compile without error
            const instance: ComponentInstance = {
                id: 'ability-scores-1',
                type: 'ability-scores',
                dataRef: { type: 'character', path: 'dnd5eData.abilityScores' },
                layout: { isVisible: true },
            };

            expect(instance.dataRef.type).toBe('character');
        });

        it('should allow sourceId on character data ref', () => {
            const characterRef: ComponentDataReference = {
                type: 'character',
                path: 'name',
                sourceId: 'player-1',
            };

            expect(characterRef.sourceId).toBe('player-1');
        });
    });

    describe('coexistence with other data types', () => {
        it('should resolve both character and statblock from same data sources', () => {
            const dataSources: ComponentDataSource[] = [
                {
                    id: 'char-1',
                    type: 'character',
                    payload: { name: 'Marcus the Fighter' },
                    updatedAt: new Date().toISOString(),
                },
                {
                    id: 'statblock-1',
                    type: 'statblock',
                    payload: { name: 'Ancient Red Dragon' },
                    updatedAt: new Date().toISOString(),
                },
            ];

            const charName = resolver.resolveDataReference<string>(
                dataSources,
                { type: 'character', path: 'name' }
            );

            const statblockName = resolver.resolveDataReference<string>(
                dataSources,
                { type: 'statblock', path: 'name' }
            );

            expect(charName).toBe('Marcus the Fighter');
            expect(statblockName).toBe('Ancient Red Dragon');
        });
    });
});




