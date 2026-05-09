import { useState } from "react";
import Modal from "../modal";
import BorrowerForm from "../forms/borrower-form";

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
            <button onClick={openModal} className="bg-green-400 hover:opacity-90 transition duration-300 cursor-pointer  border-indigo-950 border-[1.5px] rounded-md p-2">add borrower</button>
            <Modal isOpen={isOpen} closeOnEscape closeOnOverlayClick title="add borrower" size="lg" onClose={onClose} >
                <BorrowerForm onSuccess={() => {
                    onClose()
                    getBorrowers?.()
                }} />
            </Modal>
        </div>
    );
}