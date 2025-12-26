import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { isValidPhoneNumber, formatPhoneDisplay } from "@/lib/phone-utils";
import { AlertCircle } from "lucide-react";

interface PhoneEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (phone: string) => void;
  defaultPhone?: string;
}

export function PhoneEntryDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultPhone = ""
}: PhoneEntryDialogProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    // Validate phone number
    if (!phone.trim()) {
      setError("Phone number is required");
      return;
    }

    if (!isValidPhoneNumber(phone)) {
      setError("Please enter a valid phone number (at least 10 digits)");
      return;
    }

    // Clear error and call onConfirm
    setError(null);
    onConfirm(phone);
    onOpenChange(false);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setError(null); // Clear error when user types
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enter Customer Phone Number</DialogTitle>
          <DialogDescription>
            Please enter the customer's phone number to share invoice via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="9876543210 or +91 9876543210"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirm();
                }
              }}
              className={error ? "border-red-500" : ""}
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
            {phone && !error && isValidPhoneNumber(phone) && (
              <p className="text-sm text-slate-500">
                Will open: {formatPhoneDisplay(phone)}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>
            Open WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
