import { useCallback, useEffect, useState } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useToast } from './Toast'
import { Button } from './ui/button'
import { Input } from './ui/input'

const EMOJIS = ['👍', '❤️', '😂', '😮', '👀', '🔥']

// Comments + reactions for one expense. Mounted when the row is expanded.
export default function ExpenseSocial({ expenseId, me, members }) {
  const [comments, setComments] = useState(null) // null = loading
  const [reactions, setReactions] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const nameOf = (id) => members.find((m) => m.id === id)?.full_name || 'Someone'

  const load = useCallback(async () => {
    const [{ data: cs }, { data: rs }] = await Promise.all([
      supabase
        .from('expense_comments')
        .select('*')
        .eq('expense_id', expenseId)
        .order('created_at', { ascending: true }),
      supabase.from('expense_reactions').select('*').eq('expense_id', expenseId),
    ])
    setComments(cs || [])
    setReactions(rs || [])
  }, [expenseId])

  useEffect(() => { load() }, [load])

  // Live updates while the thread is open.
  useEffect(() => {
    const channel = supabase
      .channel(`expense-social-${expenseId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_comments', filter: `expense_id=eq.${expenseId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_reactions', filter: `expense_id=eq.${expenseId}` }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [expenseId, load])

  async function toggleReaction(emoji) {
    const mine = reactions.find((r) => r.user_id === me.id && r.emoji === emoji)
    if (mine) {
      // optimistic remove
      setReactions((prev) => prev.filter((r) => !(r.user_id === me.id && r.emoji === emoji)))
      const { error } = await supabase
        .from('expense_reactions')
        .delete()
        .match({ expense_id: expenseId, user_id: me.id, emoji })
      if (error) { toast('error', error.message); load() }
    } else {
      setReactions((prev) => [...prev, { expense_id: expenseId, user_id: me.id, emoji }])
      const { error } = await supabase
        .from('expense_reactions')
        .insert({ expense_id: expenseId, user_id: me.id, emoji })
      if (error) { toast('error', error.message); load() }
    }
  }

  async function addComment() {
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    const { error } = await supabase
      .from('expense_comments')
      .insert({ expense_id: expenseId, user_id: me.id, body })
    setBusy(false)
    if (error) { toast('error', error.message); return }
    setDraft('')
    load()
  }

  async function deleteComment(id) {
    const { error } = await supabase.from('expense_comments').delete().eq('id', id)
    if (error) { toast('error', error.message); return }
    load()
  }

  const counts = EMOJIS.map((emoji) => ({
    emoji,
    count: reactions.filter((r) => r.emoji === emoji).length,
    mine: reactions.some((r) => r.emoji === emoji && r.user_id === me.id),
    who: reactions.filter((r) => r.emoji === emoji).map((r) => nameOf(r.user_id)).join(', '),
  }))

  return (
    <div className="expense-social" onClick={(e) => e.stopPropagation()}>
      <div className="reaction-bar">
        {counts.map(({ emoji, count, mine, who }) => (
          <button
            key={emoji}
            type="button"
            className={`reaction-chip ${mine ? 'mine' : ''} ${count > 0 ? 'has-count' : ''}`}
            onClick={() => toggleReaction(emoji)}
            title={who || `React with ${emoji}`}
          >
            {emoji}{count > 0 && <span className="reaction-count">{count}</span>}
          </button>
        ))}
      </div>

      {comments === null ? (
        <p className="hint">Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className="hint">No comments yet. Ask what this was for 👇</p>
      ) : (
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c.id} className="comment-row">
              <div className="comment-body">
                <span className="comment-author">
                  {c.user_id === me.id ? 'You' : nameOf(c.user_id)}
                  <small>{timeAgo(c.created_at)}</small>
                </span>
                <span className="comment-text">{c.body}</span>
              </div>
              {c.user_id === me.id && (
                <Button size="icon" variant="ghost" className="icon-btn danger" title="Delete comment" onClick={() => deleteComment(c.id)}>
                  <Trash2 size={13} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="comment-compose">
        <Input
          type="text"
          value={draft}
          maxLength={500}
          placeholder="Add a comment…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addComment()}
        />
        <Button size="icon" onClick={addComment} disabled={busy || !draft.trim()} aria-label="Send comment">
          <Send size={15} />
        </Button>
      </div>
    </div>
  )
}

function timeAgo(iso) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
