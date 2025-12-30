import React, { useState } from "react";
import { BudgetSummary } from "@/components/budget-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { addMonths, format, subMonths, startOfMonth } from "date-fns";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

const BudgetPage: React.FC = () => {
    // Current viewed and allocated month
    const [selectedDate, setSelectedDate] = useState<Date>(
        startOfMonth(new Date()),
    );

    // Key to force refresh summary component
    const [refreshKey, setRefreshKey] = useState(0);

    const handleRefresh = () => {
        setRefreshKey((prev: number) => prev + 1);
    };

    const handlePrevMonth = () => {
        setSelectedDate((prev: Date) => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
        setSelectedDate((prev: Date) => addMonths(prev, 1));
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.value) return;
        const [year, month, day] = e.target.value.split("-").map(Number);
        const date = new Date(year, month - 1, day || 1);
        if (!isNaN(date.getTime())) {
            setSelectedDate(date);
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">
                        Budget
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage your monthly spending limits and track variances.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    {/* Month Navigator */}
                    <div className="flex items-center bg-muted/50 rounded-lg p-1 border shadow-sm">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handlePrevMonth}
                            className="h-9 w-9"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>

                        <div className="flex items-center">
                            {/* Month Label acting as Popover Trigger */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="px-4 min-w-[140px] font-semibold text-sm hover:bg-transparent"
                                    >
                                        {format(selectedDate, "MMMM yyyy")}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-auto p-4"
                                    align="center"
                                >
                                    <div className="space-y-2">
                                        <Label
                                            htmlFor="custom-date"
                                            className="text-xs"
                                        >
                                            Jump to Date
                                        </Label>
                                        <Input
                                            id="custom-date"
                                            type="date"
                                            value={format(
                                                selectedDate,
                                                "yyyy-MM-dd",
                                            )}
                                            onChange={handleDateChange}
                                            className="w-full"
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleNextMonth}
                            className="h-9 w-9"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </div>

            <div key={`budget-summary-${refreshKey}`}>
                <BudgetSummary
                    startDate={selectedDate}
                    onRefresh={handleRefresh}
                />
            </div>
        </div>
    );
};

export default BudgetPage;
