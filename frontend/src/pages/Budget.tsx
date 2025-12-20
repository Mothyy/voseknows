import React, { useState } from "react";
import { AllocateBudgetDialog } from "@/components/allocate-budget-dialog";
import { BudgetSummary } from "@/components/budget-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, Wallet } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

// Helper to format date for input value (YYYY-MM-DD)
const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const BudgetPage: React.FC = () => {
    // Default start date to the first day of the current month
    const [startDate, setStartDate] = useState<Date>(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    );

    // State for allocation dialog
    const [isAllocateOpen, setIsAllocateOpen] = useState(false);
    const [allocationMonth, setAllocationMonth] = useState<Date>(new Date());

    // Key to force refresh summary component
    const [refreshKey, setRefreshKey] = useState(0);

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.value) return;
        const [year, month, day] = e.target.value.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
            setStartDate(date);
        }
    };

    // For allocation month, we might want just YYYY-MM
    // But since the dialog expects a Date object representing the month
    const handleAllocationMonthChange = (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        // e.target.value is YYYY-MM
        if (!e.target.value) return;

        const [year, month] = e.target.value.split("-").map(Number);
        const date = new Date(year, month - 1, 1);
        if (!isNaN(date.getTime())) {
            setAllocationMonth(date);
        }
    };

    const handleAllocateSuccess = () => {
        setRefreshKey((prev) => prev + 1);
    };

    return (
        <div className="container mx-auto py-10 px-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Budget
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your monthly spending limits and track variances.
                        Toggle between monthly and cumulative views below.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="start-date" className="text-xs">
                            Reference Date
                        </Label>
                        <div className="relative">
                            <CalendarIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="start-date"
                                type="date"
                                className="pl-9 w-[180px]"
                                value={formatDateForInput(startDate)}
                                onChange={handleStartDateChange}
                            />
                        </div>
                    </div>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button>
                                <Wallet className="mr-2 h-4 w-4" />
                                Allocate Budgets
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="end">
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-medium leading-none">
                                        Allocation Month
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                        Select the month you want to set budgets
                                        for.
                                    </p>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="allocation-month">
                                        Month
                                    </Label>
                                    <Input
                                        id="allocation-month"
                                        type="month"
                                        value={`${allocationMonth.getFullYear()}-${String(allocationMonth.getMonth() + 1).padStart(2, "0")}`}
                                        onChange={handleAllocationMonthChange}
                                    />
                                </div>
                                <Button onClick={() => setIsAllocateOpen(true)}>
                                    Open Allocation Editor
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div key={refreshKey}>
                <BudgetSummary startDate={startDate} />
            </div>

            <AllocateBudgetDialog
                isOpen={isAllocateOpen}
                onClose={() => setIsAllocateOpen(false)}
                month={allocationMonth}
                onSuccess={handleAllocateSuccess}
            />
        </div>
    );
};

export default BudgetPage;
