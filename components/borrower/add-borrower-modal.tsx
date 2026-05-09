import { useState } from "react";
import Modal from "../modal";
import BorrowerForm from "../forms/borrower-form";
import NeobrutButton from "../neobrut-button";

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
            <Modal isOpen={isOpen} closeOnEscape closeOnOverlayClick title="add borrower" size="lg" onClose={onClose} >
                <BorrowerForm onSuccess={() => {
                    onClose()
                    getBorrowers?.()
                }} />
            </Modal>
        </div>
    );
}