'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, HelpCircle, CheckCircle } from 'lucide-react';
import { aiChatApi } from '@/lib/ai-chat';

interface TrainingFeedbackModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    question: string;
    failedSql: string;
    onComplete: () => void;
}

export function TrainingFeedbackModal({
    open,
    onOpenChange,
    question,
    failedSql,
    onComplete,
}: TrainingFeedbackModalProps) {
    const [correctSql, setCorrectSql] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!correctSql.trim()) {
            setError('Please enter the correct SQL query');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await aiChatApi.train('question_sql', correctSql.trim(), question);
            setIsSubmitted(true);

            // Close after a short delay
            setTimeout(() => {
                onComplete();
                setIsSubmitted(false);
                setCorrectSql('');
            }, 1500);
        } catch (err) {
            setError('Failed to submit training data. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        onOpenChange(false);
        setCorrectSql('');
        setError(null);
        setIsSubmitted(false);
    };

    if (isSubmitted) {
        return (
            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="sm:max-w-[500px]">
                    <div className="flex flex-col items-center justify-center py-8">
                        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                        <h3 className="text-lg font-semibold">Thank you!</h3>
                        <p className="text-sm text-muted-foreground mt-2">
                            Your feedback will help improve future queries.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <HelpCircle className="h-5 w-5" />
                        Help Improve This Query
                    </DialogTitle>
                    <DialogDescription>
                        Provide the correct SQL query for this question to improve future responses.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div>
                        <Label className="text-sm font-medium">Your Question</Label>
                        <div className="mt-1 p-3 bg-muted rounded-md text-sm">
                            {question}
                        </div>
                    </div>

                    <div>
                        <Label className="text-sm font-medium">Generated SQL (Failed)</Label>
                        <div className="mt-1 p-3 bg-slate-900 text-slate-100 rounded-md text-sm font-mono overflow-x-auto">
                            <pre>{failedSql || '(No SQL generated)'}</pre>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="correct-sql" className="text-sm font-medium">
                            Correct SQL Query
                        </Label>
                        <Textarea
                            id="correct-sql"
                            value={correctSql}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCorrectSql(e.target.value)}
                            placeholder="SELECT * FROM products WHERE ..."
                            className="mt-1 font-mono text-sm min-h-[100px]"
                        />
                        {error && (
                            <p className="text-sm text-red-500 mt-1">{error}</p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={handleClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            'Submit Correction'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
