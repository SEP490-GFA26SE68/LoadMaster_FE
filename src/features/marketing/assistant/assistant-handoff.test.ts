import { describe, expect, test } from 'vitest'
import { HANDOFF_MAX_QUESTIONS, handoffMessage, handoffQuestionsOf, handoffState } from './assistant-handoff'
import { launcherLift } from './launcher-lift'

describe('hand-off to the contact form', () => {
  test('router state carries the visitor questions, only the last few', () => {
    const questions = ['1', '2', '3', '4', '5', '6', '7']
    expect(handoffQuestionsOf(handoffState(questions))).toStrictEqual(questions.slice(-HANDOFF_MAX_QUESTIONS))
  })

  test('any other router state is not a hand-off', () => {
    for (const state of [null, undefined, 'x', {}, { assistantHandoff: null }, { assistantHandoff: { questions: 'Giá?' } }]) {
      expect(handoffQuestionsOf(state)).toBeNull()
    }
    // Phần tử không phải chữ hay chỉ có khoảng trắng bị bỏ: không còn câu nào thì form không điền gì
    expect(handoffQuestionsOf({ assistantHandoff: { questions: [1, ' ', 'Giá?'] } })).toStrictEqual(['Giá?'])
  })

  test('the message lists the questions under a short intro and never passes the form limit', () => {
    expect(handoffMessage('Câu hỏi:', ['Giá?', 'Dùng thử?'])).toBe('Câu hỏi:\n- Giá?\n- Dùng thử?')
    expect(handoffMessage('Câu hỏi:', ['x'.repeat(50)], 20)).toHaveLength(20)
  })
})

describe('launcherLift', () => {
  const zone = { top: 800, bottom: 848, left: 1300, right: 1424 }

  test('nothing to avoid nearby: no lift', () => {
    expect(launcherLift(zone, [])).toBe(0)
    expect(launcherLift(zone, [{ top: 800, bottom: 848, left: 100, right: 300 }])).toBe(0)
    expect(launcherLift(zone, [{ top: 100, bottom: 140, left: 1300, right: 1424 }])).toBe(0)
  })

  test('a control under the launcher lifts it above that control plus the gap', () => {
    expect(launcherLift(zone, [{ top: 820, bottom: 860, left: 1380, right: 1424 }], 12)).toBe(848 + 12 - 820)
    // Hai phần tử: nâng theo phần tử cao nhất
    expect(launcherLift(zone, [{ top: 840, bottom: 880, left: 1300, right: 1340 }, { top: 790, bottom: 830, left: 1400, right: 1420 }], 12)).toBe(70)
  })

  test('lifting onto another control lifts again, above both', () => {
    // Phần tử dưới (820–860) nâng nút 40 px, tới 760–808: chạm phần tử trên (700–770) nên nâng tiếp tới trên nó
    const stacked = [{ top: 820, bottom: 860, left: 1300, right: 1424 }, { top: 700, bottom: 770, left: 1380, right: 1424 }]
    expect(launcherLift(zone, stacked, 12)).toBe(848 + 12 - 700)
    // Phần tử trên không chạm vị trí gốc và nút không nâng thì không tính
    expect(launcherLift(zone, [stacked[1]!], 12)).toBe(0)
  })
})
