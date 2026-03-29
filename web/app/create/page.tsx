'use client';
import { FormEvent, useMemo } from 'react';
import Navbar from "../../components/Navbar";
import AuthGuard from "../../components/AuthGuard";
import { useLocalStorage } from '../lib/hooks/useLocalStorage';

const CREATE_MARKET_DRAFT_KEY = 'predinex_create_market_draft_v1';

interface CreateMarketDraft {
    question: string;
}

const EMPTY_DRAFT: CreateMarketDraft = {
    question: '',
};

export default function CreateMarket() {
    const [draft, setDraft, clearDraft] = useLocalStorage<CreateMarketDraft>(
        CREATE_MARKET_DRAFT_KEY,
        EMPTY_DRAFT
    );

    const isDraftEmpty = useMemo(() => draft.question.trim().length === 0, [draft.question]);

    const handleQuestionChange = (value: string) => {
        setDraft((prev) => ({ ...prev, question: value }));
    };

    const handleClearDraft = () => {
        clearDraft();
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // Placeholder submit until the transaction flow is wired.
    };

    return (
        <main className="min-h-screen bg-background">
            <Navbar />
            <AuthGuard>
                <div className="container mx-auto px-4 py-12 max-w-2xl">
                    <h1 className="text-3xl font-bold mb-8">Create New Market</h1>
                    <form className="space-y-6" onSubmit={handleSubmit}>
                       <div className="p-6 rounded-xl border border-border space-y-4">
                           <div>
                                <label className="block text-sm font-medium mb-2">Question</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 rounded-lg bg-background border border-input"
                                    placeholder="e.g. Will Bitcoin be above $60k?"
                                    value={draft.question}
                                    onChange={(event) => handleQuestionChange(event.target.value)}
                                    autoComplete="off"
                                />
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Drafts are saved locally in your browser and restored after refresh.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleClearDraft}
                                    disabled={isDraftEmpty}
                                    className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Clear Draft
                                </button>
                                <span className="text-xs text-muted-foreground">
                                    Transaction-only values are not persisted.
                                </span>
                            </div>
                            <button type="submit" className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold">
                                Create Market (50 STX)
                            </button>
                        </div>
                    </form>
                </div>
            </AuthGuard>
        </main>
    );
}
