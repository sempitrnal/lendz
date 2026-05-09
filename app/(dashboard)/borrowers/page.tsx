"use client"

import AddBorrowerModal from "@/components/borrower/add-borrower-modal";
import BorrowersList from "@/components/borrower/borrower-list";
import { useState } from "react";

export default  function BorrowersPage(){
    const [isAddBorrowerModalOpen, setIsAddBorrowerModalOpen] = useState(false)
    function openAddBorrowerModal(){
        setIsAddBorrowerModalOpen(true)
    }
    function closeAddBorrowerModal(){
        setIsAddBorrowerModalOpen(false)
    }
    return <div className="flex flex-col">
            <AddBorrowerModal openModal={openAddBorrowerModal} isOpen={isAddBorrowerModalOpen} onClose={closeAddBorrowerModal} />
            <BorrowersList/>
    </div>
}           