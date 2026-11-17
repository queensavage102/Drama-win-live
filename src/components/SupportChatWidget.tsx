import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Headphones,
  Loader2,
  Mail,
  MessageSquareHeart,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ADMIN_NOTIFICATION_EMAIL,
  R3_BOOST_ZAR,
  R3_MYSTERY_CYCLE_ADS,
} from '../constants';
import { SupportCategory } from '../types';

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export interface SupportTicketSubmissionInput {
  username: string;
  contact: string;
  category: SupportCategory;
  subject: string;
  message: string;
}

interface SupportChatWidgetProps {
  username: string;
  contact: string;
  coins: number;
  weeklyCoins: number;
  qualificationThreshold: number;
  poolPrizeZar: number;
  isFirebaseSignedIn: boolean;
  firebaseEmail?: string | null;
  onSignInGoogle: () => Promise<void>;
  onSubmitSupportTicket: (
    input: SupportTicketSubmissionInput
  ) => Promise<{ id: string; syncedToCloud: boolean }>;
}

const INITIAL_BOT_MESSAGE: ChatMessageItem = {
  id: 'welcome-bot',
  role: 'assistant',
  text: `Welcome to DramaWin VIP Support! Ask me about earning Coins, the ${R3_MYSTERY_CYCLE_ADS}-Ad R${R3_BOOST_ZAR} Mystery Box Boost & auto-reset cycle, or Sunday R${50}+ Pool payouts — or switch to "Message Admin / Claim Prize Help" to send a direct ticket.`,
};

const QUICK_PROMPTS = [
  `How does the ${R3_MYSTERY_CYCLE_ADS}-ad R${R3_BOOST_ZAR} boost work?`,
  'How do I earn coins fastest?',
  'When are Sunday Pool payouts?',
];

const SUPPORT_CATEGORY_OPTIONS: { value: SupportCategory; label: string }[] = [
  { value: 'claim_prize', label: 'Claim Prize Help / Payout' },
  { value: 'mystery_box', label: `${R3_MYSTERY_CYCLE_ADS}-Ad R${R3_BOOST_ZAR} Mystery Box` },
  { value: 'coins', label: 'Coins & Daily Streak' },
  { value: 'sunday_pool', label: 'Sunday Pool & Leaderboard' },
  { value: 'feedback', label: 'Feedback & Suggestions' },
  { value: 'other', label: 'Other Support' },
];

function buildFallbackSupportReply(
  question: string,
  ctx: {
    username: string;
    coins: number;
    weeklyCoins: number;
    qualificationThreshold: number;
    poolPrizeZar: number;
  }
): string {
  const q = question.toLowerCase();
  const safeThreshold = Math.max(1, ctx.qualificationThreshold || 500000);
  const remainingWeekly = Math.max(0, safeThreshold - (ctx.weeklyCoins || 0));

  if (
    q.includes('11') ||
    q.includes('r3') ||
    q.includes('mystery') ||
    q.includes('box') ||
    q.includes('boost') ||
    q.includes('vault') ||
    q.includes('reset')
  ) {
    return `Here is how the ${R3_MYSTERY_CYCLE_ADS}-Ad R${R3_BOOST_ZAR} Mystery Box Boost works:\n\n• Open the Secret Mystery Vault (Rewards tab or top-right Gift icon) and tap any glowing box (#1–#12).\n• Watch the full 20-second sponsor ad inside the modal to unlock that box (+100 Bonus Coins, or an occasional "Oops, try next box"). Closing the modal early cancels the timer and reward.\n• When you finish all ${R3_MYSTERY_CYCLE_ADS} video ads in a cycle, you unlock the R${R3_BOOST_ZAR} Progress Bar Boost (+1,000 Bonus Coins) added directly to your Wallet and Weekly Tournament goal.\n• Right after the ${R3_MYSTERY_CYCLE_ADS}th box, the grid automatically resets back to Box #1 so you can repeat the cycle immediately!`;
  }

  if (
    q.includes('fast') ||
    q.includes('earn') ||
    q.includes('coin') ||
    q.includes('streak') ||
    q.includes('check') ||
    q.includes('watch') ||
    q.includes('pot')
  ) {
    return `Fastest ways to stack Coins on DramaWin (Wallet: ${ctx.coins.toLocaleString()} Coins | Weekly: ${ctx.weeklyCoins.toLocaleString()} / ${safeThreshold.toLocaleString()}):\n\n1. Watch Short Dramas: Play any episode for 30+ seconds to trigger the 60-second Coin Pot (+100 to +300 Coins per cycle).\n2. Repeat the ${R3_MYSTERY_CYCLE_ADS}-Ad R${R3_BOOST_ZAR} Mystery Vault: Earn +100 Bonus Coins per completed 20s box ad, plus +1,000 Bonus Coins on every ${R3_MYSTERY_CYCLE_ADS}th box (auto-resets to Box #1).\n3. Daily Check-In Streak (Mon–Sun): Visit the Rewards tab and tap Claim on today's card for +100 to +300 Coins, plus Featured Hero bonus claims.`;
  }

  if (
    q.includes('sunday') ||
    q.includes('pool') ||
    q.includes('payout') ||
    q.includes('qualif') ||
    q.includes('leaderboard') ||
    q.includes('winner') ||
    q.includes('prize') ||
    q.includes('claim') ||
    q.includes('r50')
  ) {
    return `Sunday Prize Pool & Payout Rules (Current Pool: R${ctx.poolPrizeZar}):\n\n• Qualification Goal: Reach ${safeThreshold.toLocaleString()} Weekly Coins before Sunday 23:59 SAST (you currently have ${ctx.weeklyCoins.toLocaleString()} — ${remainingWeekly === 0 ? 'QUALIFIED!' : `${remainingWeekly.toLocaleString()} more needed`}).\n• Payout Split: When 3 or more players qualify by Sunday 23:59 SAST, the Top 3 split the pool: 50% (1st), 30% (2nd), and 20% (3rd).\n• Rollover Protection: If fewer than 3 players qualify, the pool rolls over (+R50 added for next week).\n• To claim a prize or voucher, tap "Message Admin / Claim Help" at the top of this chat.`;
  }

  return `Hi ${ctx.username || 'Player'}! Here is your quick DramaWin guide (Wallet: ${ctx.coins.toLocaleString()} Coins | Weekly Goal: ${ctx.weeklyCoins.toLocaleString()} / ${safeThreshold.toLocaleString()}):\n\n• ${R3_MYSTERY_CYCLE_ADS}-Ad R${R3_BOOST_ZAR} Boost: Open boxes #1–#12 in the Secret Mystery Vault and watch each full 20s ad. The ${R3_MYSTERY_CYCLE_ADS}th ad unlocks +1,000 Bonus Coins and auto-resets the grid back to Box #1.\n• Watch & Streak: Earn +100 to +300 Coins from the 60s Episode Coin Pot and Daily Check-In Streak.\n• Sunday Pool (R${ctx.poolPrizeZar}): Top 3 players with ${safeThreshold.toLocaleString()}+ weekly coins split the Sunday payout (50% / 30% / 20%).\n\nNeed direct payout or voucher help? Switch to the "Message Admin / Claim Help" tab right above!`;
}

export const SupportChatWidget: React.FC<SupportChatWidgetProps> = ({
  username,
  contact,
  coins,
  weeklyCoins,
  qualificationThreshold,
  poolPrizeZar,
  isFirebaseSignedIn,
  firebaseEmail = null,
  onSignInGoogle,
  onSubmitSupportTicket,
}) => {
  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'ai' | 'ticket'>('ai');

  // AI chat state
  const [messages, setMessages] = useState<ChatMessageItem[]>([INITIAL_BOT_MESSAGE]);
  const [chatInput, setChatInput] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Admin Ticket / Claim Prize Help form state
  const [ticketName, setTicketName] = useState(username || 'Player');
  const [ticketContact, setTicketContact] = useState(
    contact && contact !== 'Instant Play' ? contact : firebaseEmail || ''
  );
  const [ticketCategory, setTicketCategory] = useState<SupportCategory>('claim_prize');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const [ticketError, setTicketError] = useState<string | null>(null);
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    id: string;
    syncedToCloud: boolean;
  } | null>(null);

  useEffect(() => {
    setTicketName((prev) => (prev.trim() ? prev : username || 'Player'));
  }, [username]);

  useEffect(() => {
    if (firebaseEmail && !ticketContact.trim()) {
      setTicketContact(firebaseEmail);
    } else if (contact && contact !== 'Instant Play' && !ticketContact.trim()) {
      setTicketContact(contact);
    }
  }, [contact, firebaseEmail, ticketContact]);

  useEffect(() => {
    if (open && activeMode === 'ai' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, activeMode, messages]);

  const sendAiPrompt = (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    const now = Date.now();
    const userMsg: ChatMessageItem = {
      id: `user-${now}`,
      role: 'user',
      text: trimmed,
    };
    const replyText = buildFallbackSupportReply(trimmed, {
      username,
      coins,
      weeklyCoins,
      qualificationThreshold,
      poolPrizeZar,
    });
    const botMsg: ChatMessageItem = {
      id: `bot-${now + 1}`,
      role: 'assistant',
      text: replyText,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setChatInput('');
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendAiPrompt(chatInput);
  };

  const handleGoogleConnectClick = async () => {
    setTicketError(null);
    setSigningInGoogle(true);
    try {
      await onSignInGoogle();
    } catch (err) {
      setTicketError(
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled or blocked.'
      );
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError(null);

    if (ticketName.trim().length < 2) {
      setTicketError('Please enter your player name (at least 2 characters).');
      return;
    }
    if (ticketContact.trim().length < 4) {
      setTicketError('Please enter your email or WhatsApp contact so Admin can reply.');
      return;
    }
    if (ticketSubject.trim().length < 2) {
      setTicketError('Please add a brief subject for your message.');
      return;
    }
    if (ticketMessage.trim().length < 5) {
      setTicketError('Please write a clear message or prize claim details.');
      return;
    }

    setSubmittingTicket(true);
    try {
      const receipt = await onSubmitSupportTicket({
        username: ticketName.trim(),
        contact: ticketContact.trim(),
        category: ticketCategory,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
      });
      setSubmittedReceipt(receipt);
      setTicketSubject('');
      setTicketMessage('');
    } catch (err) {
      setTicketError(
        err instanceof Error ? err.message : 'Unable to send support message.'
      );
    } finally {
      setSubmittingTicket(false);
    }
  };

  return (
    <div className="fixed bottom-20 right-3 sm:right-6 z-[60] flex flex-col items-end gap-2.5">
      {open && (
        <section
          role="dialog"
          aria-label="DramaWin AI Support Assistant & Admin Help"
          className="obsidian-card w-[calc(100vw-1.5rem)] max-w-md h-[min(76vh,590px)] rounded-2xl border border-[#D4AF37]/50 shadow-[0_20px_70px_rgba(0,0,0,0.88),0_0_45px_rgba(212,175,55,0.18)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#1A1409] via-[#12100B] to-[#1A1409] border-b border-[#D4AF37]/30 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl gold-gradient-bg text-[#181307] flex items-center justify-center shadow-md shrink-0">
                <Headphones className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-display font-bold gold-gradient-text truncate">
                  DramaWin VIP Support
                </h2>
                <p className="text-[11px] text-[#BFB7A6] truncate">
                  Coins · {R3_MYSTERY_CYCLE_ADS}-Ad R{R3_BOOST_ZAR} Boost · Sunday Pool
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close support chat"
              className="min-h-[36px] min-w-[36px] rounded-xl border border-white/10 text-[#BFB7A6] hover:text-[#F6F2E9] hover:bg-white/[0.06] flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div
            role="tablist"
            aria-label="Support modes"
            className="grid grid-cols-2 gap-1.5 p-2 bg-[#09090D] border-b border-white/[0.08] shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'ai'}
              onClick={() => setActiveMode('ai')}
              className={`min-h-[38px] px-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMode === 'ai'
                  ? 'gold-gradient-bg text-[#181307] shadow'
                  : 'text-[#A69F91] hover:text-[#F6F2E9] hover:bg-white/[0.04]'
              }`}
            >
              <Bot className="w-3.5 h-3.5 shrink-0" />
              <span>AI Assistant</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeMode === 'ticket'}
              onClick={() => setActiveMode('ticket')}
              className={`min-h-[38px] px-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMode === 'ticket'
                  ? 'gold-gradient-bg text-[#181307] shadow'
                  : 'text-[#A69F91] hover:text-[#F6F2E9] hover:bg-white/[0.04]'
              }`}
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Message Admin / Claim Help</span>
            </button>
          </div>

          {/* Tab Body */}
          {activeMode === 'ai' ? (
            <div className="flex-1 flex flex-col min-h-0 bg-[#070709]">
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-3.5 space-y-3"
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'gold-gradient-bg text-[#181307] font-semibold rounded-br-sm shadow'
                          : 'bg-[#121218] border border-[#D4AF37]/25 text-[#EFE9DC] rounded-bl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Starter Prompt Buttons */}
              <div className="px-3.5 pb-2 pt-1 flex flex-wrap gap-1.5 border-t border-white/[0.06] bg-[#0B0B10] shrink-0">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendAiPrompt(q)}
                    className="px-2.5 py-1.5 rounded-lg bg-[#16140D] border border-[#D4AF37]/30 text-[11px] font-medium text-[#FCE7A2] hover:bg-[#231D0F] transition-colors cursor-pointer text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <form
                onSubmit={handleChatSubmit}
                className="p-3 bg-[#09090D] border-t border-white/[0.08] flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask about coins, R3 boost, or payouts..."
                  className="flex-1 min-h-[42px] px-3.5 rounded-xl bg-[#070709] border border-[#D4AF37]/30 text-xs sm:text-sm text-[#F6F2E9] placeholder:text-[#7A746A] focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  aria-label="Send message"
                  className="min-h-[42px] min-w-[42px] rounded-xl gold-gradient-bg text-[#181307] flex items-center justify-center hover:brightness-105 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 bg-[#070709] space-y-3.5">
              {submittedReceipt ? (
                <div className="rounded-2xl bg-[#111510] border border-emerald-500/40 p-4 space-y-3 text-center">
                  <div className="w-11 h-11 rounded-xl gold-gradient-bg text-[#181307] mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-display font-bold text-[#FCE7A2]">
                      Message Sent to DramaWin Admin!
                    </h3>
                    <p className="text-xs text-[#CFC8B9]">
                      Ticket <span className="font-mono-num font-bold text-white">{submittedReceipt.id}</span> has been recorded.
                    </p>
                    <p className="text-[11px] text-emerald-300">
                      {submittedReceipt.syncedToCloud
                        ? `Saved to Firebase Firestore & queued Gmail alert to ${ADMIN_NOTIFICATION_EMAIL}.`
                        : 'Saved to local Admin Board. Connect Google anytime to sync to Firebase Cloud & Gmail notifications.'}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSubmittedReceipt(null)}
                      className="flex-1 min-h-[40px] px-3 rounded-xl gold-gradient-bg text-[#181307] text-xs font-bold cursor-pointer"
                    >
                      Send Another Message
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMode('ai')}
                      className="min-h-[40px] px-3 rounded-xl border border-white/15 text-xs text-[#C4BDB0] hover:bg-white/[0.04] cursor-pointer"
                    >
                      Back to AI Chat
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleTicketSubmit} className="space-y-3">
                  {/* Cloud / Gmail Status Pill */}
                  <div
                    className={`rounded-xl px-3 py-2.5 border text-[11px] space-y-2 ${
                      isFirebaseSignedIn
                        ? 'bg-[#0F1711] border-emerald-500/35 text-emerald-200'
                        : 'bg-[#17130A] border-[#D4AF37]/35 text-[#FCE7A2]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {isFirebaseSignedIn
                          ? `Firebase Sync Active (${firebaseEmail || 'Signed In'}) — saves to Admin Board & emails ${ADMIN_NOTIFICATION_EMAIL}.`
                          : `Sign in with Google to send directly to Cloud Firestore & ${ADMIN_NOTIFICATION_EMAIL} (or submit locally right now).`}
                      </span>
                    </div>
                    {!isFirebaseSignedIn && (
                      <button
                        type="button"
                        disabled={signingInGoogle}
                        onClick={() => void handleGoogleConnectClick()}
                        className="w-full min-h-[34px] px-3 rounded-lg gold-gradient-bg text-[#181307] font-bold text-[11px] hover:brightness-105 disabled:opacity-60 cursor-pointer"
                      >
                        {signingInGoogle
                          ? 'Connecting Google...'
                          : 'Sign in with Google for Cloud & Gmail Alert'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#BFB7A6]">Player Name *</label>
                      <input
                        type="text"
                        required
                        maxLength={40}
                        value={ticketName}
                        onChange={(e) => setTicketName(e.target.value)}
                        placeholder="Your username"
                        className="w-full min-h-[40px] px-3 rounded-xl bg-[#0D0D13] border border-white/[0.12] text-xs text-[#F6F2E9] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-[#BFB7A6]">Email or WhatsApp *</label>
                      <input
                        type="text"
                        required
                        maxLength={120}
                        value={ticketContact}
                        onChange={(e) => setTicketContact(e.target.value)}
                        placeholder="you@email.com or 082..."
                        className="w-full min-h-[40px] px-3 rounded-xl bg-[#0D0D13] border border-white/[0.12] text-xs text-[#F6F2E9] focus:outline-none focus:border-[#D4AF37]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#BFB7A6]">Topic / Category</label>
                    <select
                      value={ticketCategory}
                      onChange={(e) => setTicketCategory(e.target.value as SupportCategory)}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#0D0D13] border border-white/[0.12] text-xs text-[#F6F2E9] focus:outline-none focus:border-[#D4AF37]"
                    >
                      {SUPPORT_CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#BFB7A6]">Subject *</label>
                    <input
                      type="text"
                      required
                      maxLength={120}
                      value={ticketSubject}
                      onChange={(e) => setTicketSubject(e.target.value)}
                      placeholder="e.g. Claim Sunday Prize / Voucher Help"
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#0D0D13] border border-white/[0.12] text-xs text-[#F6F2E9] focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[#BFB7A6]">Message / Prize Details *</label>
                    <textarea
                      rows={3}
                      required
                      maxLength={2000}
                      value={ticketMessage}
                      onChange={(e) => setTicketMessage(e.target.value)}
                      placeholder="Include voucher code, rank, or question..."
                      className="w-full p-3 rounded-xl bg-[#0D0D13] border border-white/[0.12] text-xs text-[#F6F2E9] focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  {ticketError && (
                    <p className="rounded-xl bg-red-950/60 border border-red-500/40 px-3 py-2 text-xs text-red-100">
                      {ticketError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submittingTicket}
                    className="w-full min-h-[44px] px-4 rounded-xl gold-gradient-bg text-[#181307] font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 hover:brightness-105 disabled:opacity-60 cursor-pointer"
                  >
                    {submittingTicket ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending to Admin...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>Send Message to Admin</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      {/* Floating Support Launcher Button */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? 'Close VIP Support Assistant' : 'Open VIP Support Assistant'}
        className="group min-h-[48px] px-4 rounded-2xl gold-gradient-bg text-[#181307] border border-[#FFF2C2] shadow-[0_10px_30px_rgba(212,175,55,0.45)] hover:brightness-105 active:scale-[0.97] transition-all inline-flex items-center gap-2 font-bold text-xs sm:text-sm cursor-pointer"
      >
        {open ? (
          <>
            <X className="w-4 h-4" />
            <span>Close Support</span>
          </>
        ) : (
          <>
            <MessageSquareHeart className="w-4.5 h-4.5" />
            <span>Support AI</span>
            <Sparkles className="w-3.5 h-3.5 opacity-80" />
          </>
        )}
      </button>
    </div>
  );
};
