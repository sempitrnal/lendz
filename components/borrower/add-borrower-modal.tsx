import { useState } from "react";
import BorrowerForm from "../forms/borrower-form";
import NeobrutButton from "../neobrut-button";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface AddBorrowerModalProps {
    isOpen: boolean;
    onClose: () => void
    openModal: () => void
    getBorrowers: () => void
}
export default function AddBorrowerModal({
    isOpen, onClose, openModal, getBorrowers
}: AddBorrowerModalProps) {

    return (
        <div className="mb-10">
            <NeobrutButton onClick={openModal} color="green">add</NeobrutButton>
            <Dialog open={isOpen} onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>add borrower</DialogTitle>
                    </DialogHeader>

                    <BorrowerForm
                        onSuccess={() => {
                            onClose();
                            getBorrowers?.();
                        }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}