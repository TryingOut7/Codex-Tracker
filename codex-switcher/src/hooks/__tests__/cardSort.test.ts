import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardSort } from '../useCardSort';
import { makeAccount } from '../../test/factories';

vi.mock('../../api', () => ({
  api: { updateSortOrder: vi.fn().mockResolvedValue(undefined) },
}));

const mockDragEvent = () =>
  ({
    preventDefault: vi.fn(),
    dataTransfer: { effectAllowed: '', dropEffect: '' },
  }) as unknown as React.DragEvent;

describe('useCardSort', () => {
  const accs = [
    makeAccount({ id: 'a', sort_order: 0 }),
    makeAccount({ id: 'b', sort_order: 1 }),
    makeAccount({ id: 'c', sort_order: 2 }),
  ];

  beforeEach(() => vi.clearAllMocks());

  it('initial sortedAccounts matches the input order', () => {
    const { result } = renderHook(() => useCardSort(accs));
    expect(result.current.sortedAccounts.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('reorders cards when dragging b over a', () => {
    const { result } = renderHook(() => useCardSort(accs));

    act(() => {
      result.current.onDragStart('b', mockDragEvent());
      result.current.onDragOver('a', mockDragEvent());
    });

    expect(result.current.sortedAccounts.map((a) => a.id)).toEqual(['b', 'a', 'c']);
  });

  it('reorders cards when dragging a to the end (over c)', () => {
    const { result } = renderHook(() => useCardSort(accs));

    act(() => {
      result.current.onDragStart('a', mockDragEvent());
      result.current.onDragOver('c', mockDragEvent());
    });

    expect(result.current.sortedAccounts.map((a) => a.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not change order when dragging an item over itself', () => {
    const { result } = renderHook(() => useCardSort(accs));

    act(() => {
      result.current.onDragStart('b', mockDragEvent());
      result.current.onDragOver('b', mockDragEvent());
    });

    expect(result.current.sortedAccounts.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('appends newly added accounts to the end', () => {
    const initial = [makeAccount({ id: 'a', sort_order: 0 }), makeAccount({ id: 'b', sort_order: 1 })];
    const { result, rerender } = renderHook(({ accounts }) => useCardSort(accounts), {
      initialProps: { accounts: initial },
    });

    const extended = [...initial, makeAccount({ id: 'c', sort_order: 2 })];
    rerender({ accounts: extended });

    expect(result.current.sortedAccounts.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('removes deleted accounts from the sorted list', () => {
    const { result, rerender } = renderHook(({ accounts }) => useCardSort(accounts), {
      initialProps: { accounts: accs },
    });

    rerender({ accounts: [makeAccount({ id: 'a', sort_order: 0 }), makeAccount({ id: 'c', sort_order: 2 })] });

    expect(result.current.sortedAccounts.map((a) => a.id)).toEqual(['a', 'c']);
  });
});
