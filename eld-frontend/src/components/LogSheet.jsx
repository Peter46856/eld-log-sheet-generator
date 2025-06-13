// src/components/LogSheetDisplay.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import './LogSheet.css'; // Assuming you have a CSS file for styling

function LogSheetDisplay({ tripId }) {
    const [dailyLogs, setDailyLogs] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const API_BASE_URL = import.meta.env.VITE_APP_API_URL;
 
     const FALLBACK_LOCAL_API_URL = 'http://127.0.0.1:8000/api/';

    const backendApiUrl = API_BASE_URL || FALLBACK_LOCAL_API_URL;


    // useCallback to memoize calculateDailySummaries to prevent unnecessary re-renders
    const calculateDailySummaries = useCallback((logs) => {
        let totalDriving = 0;
        let totalOnDutyNotDriving = 0;
        let totalOnDuty = 0;
        let totalSleeperBerth = 0;
        let totalOffDuty = 0;

        logs.forEach(log => {
            const start = new Date(log.start_time);
            const end = new Date(log.end_time);
            // Calculate duration in minutes, then convert to hours
            const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
            const durationHours = durationMinutes / 60;

            switch (log.status) {
                case 'DRIVING':
                    totalDriving += durationHours;
                    totalOnDuty += durationHours; // Driving time is also on-duty
                    break;
                case 'ON_DUTY_NOT_DRIVING':
                    totalOnDutyNotDriving += durationHours;
                    totalOnDuty += durationHours;
                    break;
                case 'SLEEPER_BERTH':
                    totalSleeperBerth += durationHours;
                    break;
                case 'OFF_DUTY':
                    totalOffDuty += durationHours;
                    break;
                default:
                    console.warn(`Unknown log status encountered: ${log.status}`);
                    break;
            }
        });

        return {
            totalDriving: totalDriving.toFixed(2),
            totalOnDutyNotDriving: totalOnDutyNotDriving.toFixed(2),
            totalOnDuty: totalOnDuty.toFixed(2),
            totalSleeperBerth: totalSleeperBerth.toFixed(2),
            totalOffDuty: totalOffDuty.toFixed(2),
        };
    }, []); // Empty dependency array means this function is created once

    // useCallback to memoize handleGeneratePdf
    const handleGeneratePdf = useCallback((date, logs) => {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const marginX = 10;
        const marginY = 10;
        let currentY = marginY; // Starting Y for the top section

        // Define a consistent thin line width for dashes
        const thinDashLineWidth = 0.05; 

        // --- TOP SECTION: Drivers Daily Log, Date, and Notes ---
        
        // 1. "Drivers Daily Log (24 hours)" - Left Aligned
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Drivers Daily Log', marginX, currentY); // Aligned left
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('(24 hours)', marginX, currentY + 4); // Aligned left, slightly below

        // 2. Date - Centered with values on dashes and labels below
        const dateObj = new Date(date);
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
        const day = dateObj.getDate().toString().padStart(2, '0');
        const year = dateObj.getFullYear().toString();
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');

        const dashLength = 12; // Length of each dash for MM, DD, YY
        const slashWidth = 2; // Approximate width for the slash separator
        const textOffsetOnDash = 2; // Offset to place text slightly above the dash
        const labelOffsetBelowDash = 4; // Offset to place label below the dash
        const dateSectionWidth = (dashLength * 3) + (slashWidth * 2) + (3 * 2); // Total width for date section (3 dashes, 2 slashes, some padding)
        const dateSectionStartX = (pageWidth / 2) - (dateSectionWidth / 2);

        doc.setLineWidth(thinDashLineWidth); // Set line width for date dashes

        // Month
        let dateCurrentX = dateSectionStartX;
        doc.text(month, dateCurrentX + dashLength / 2, currentY + textOffsetOnDash, { align: 'center' });
        doc.line(dateCurrentX, currentY + 2, dateCurrentX + dashLength, currentY + 2); // Dash for month
        doc.text('(month)', dateCurrentX + dashLength / 2, currentY + 2 + labelOffsetBelowDash, { align: 'center' });
        dateCurrentX += dashLength + slashWidth + 2; // Move past dash and slash, add a little extra padding
        doc.text('/', dateCurrentX - (slashWidth / 2) - 1, currentY + 2, { align: 'center' }); // Slash

        // Day
        dateCurrentX += slashWidth; // Adjust for the slash itself
        doc.text(day, dateCurrentX + dashLength / 2, currentY + textOffsetOnDash, { align: 'center' });
        doc.line(dateCurrentX, currentY + 2, dateCurrentX + dashLength, currentY + 2); // Dash for day
        doc.text('/', dateCurrentX - (slashWidth / 2) - 1, currentY + 2, { align: 'center' }); // Slash

        // Year
        dateCurrentX += slashWidth; // Adjust for the slash itself
        doc.text(year, dateCurrentX + dashLength / 2, currentY + textOffsetOnDash, { align: 'center' });
        doc.line(dateCurrentX, currentY + 2, dateCurrentX + dashLength, currentY + 2); // Dash for year


        // 3. Notes - Right Aligned
        doc.setFontSize(7); // Ensure font size is reset after date values
        doc.text('Original - File at home terminal.', pageWidth - marginX, currentY, { align: 'right' });
        doc.text('Duplicate - Driver retains in his/her possession for 8 days.', pageWidth - marginX, currentY + 5, { align: 'right' });
        
        currentY += 20; // Move down sufficiently after the top section, including all elements

        // --- Header Information (Adjusted for left/right columns) ---
        doc.setFontSize(10);
        const col1StartX = marginX;
        const col2StartX = pageWidth / 2 + 20; 
        const inputLineHeight = 8; 
        const inputFieldHeight = 7; 
        const dashInputLength = 60; 
        const labelVerticalOffset = 5; 
        const truckLabelOffsetBelowBox = 8; 

        // Define a common starting X for all outlined inputs in the left column
        const outlinedInputStartX = col1StartX + 10;

        // Row 1: From/To (now using doc.line for dashes)
        let row1Y = currentY;
        const fromLabel = "From:";
        const toLabel = "To:";
        
        doc.text(fromLabel, col1StartX, row1Y);
        doc.text(toLabel, col2StartX, row1Y);

        // Calculate start X for the lines after the labels
        const fromLabelWidth = doc.getTextWidth(fromLabel);
        const toLabelWidth = doc.getTextWidth(toLabel);
        const fromLineStartX = col1StartX + fromLabelWidth + 2; // +2 for padding
        const toLineStartX = col2StartX + toLabelWidth + 2; // +2 for padding
        const fromToLineLength = 60; // Consistent line length for these inputs

        doc.setLineWidth(thinDashLineWidth); // Set line width for From/To dashes
        doc.line(fromLineStartX, row1Y, fromLineStartX + fromToLineLength, row1Y);
        doc.line(toLineStartX, row1Y, toLineStartX + fromToLineLength, row1Y);
        row1Y += inputLineHeight;

        // Row 2: "Total Miles Driving Today" and "Total Mileage Today" side-by-side (left) & "Name of Carrier" (right)
        let row2Y = row1Y + inputFieldHeight * 0.7; // Align input box top with baseline

        // Left: Total Miles Driving Today (outlined input with label below)
        const milesDrivingLabel = 'Total Miles Driving Today';
        const milesDrivingInputWidth = 35; 
        doc.rect(outlinedInputStartX, row2Y - inputFieldHeight * 0.7, milesDrivingInputWidth, inputFieldHeight); 
        doc.text(milesDrivingLabel, outlinedInputStartX + milesDrivingInputWidth / 2, row2Y + labelVerticalOffset, { align: 'center' });
        
        // Left: Total Mileage Today (next to "Total Miles Driving Today")
        const mileageTodayLabel = 'Total Mileage Today';
        const mileageTodayInputWidth = 35; 
        const mileageTodayInputX = outlinedInputStartX + milesDrivingInputWidth + 5; 
        doc.rect(mileageTodayInputX, row2Y - inputFieldHeight * 0.7, mileageTodayInputWidth, inputFieldHeight); 
        doc.text(mileageTodayLabel, mileageTodayInputX + mileageTodayInputWidth / 2, row2Y + labelVerticalOffset, { align: 'center' });

        // Right: Name of Carrier or Carriers (dash input with label below)
        const carrierLabel = 'Name of Carrier or Carriers';
        const carrierDashY = row2Y; 
        doc.setLineWidth(thinDashLineWidth); // Set line width for carrier dash
        doc.line(col2StartX, carrierDashY, col2StartX + dashInputLength, carrierDashY); 
        doc.text(carrierLabel, col2StartX + dashInputLength / 2, carrierDashY + labelVerticalOffset, { align: 'center' }); 
        
        let nextY = row2Y + inputFieldHeight * 0.7 + labelVerticalOffset + 5; 

        // Row 3: Truck/Tractor and Trailer Numbers (left) & Main Office Address (right)
        let row3Y = nextY;

        // Left: Truck/Tractor and Trailer Numbers or License Plate(s)/State (outlined input with label below)
        const truckLabelLine1 = `Truck/Tractor and Trailer Numbers or`;
        const truckLabelLine2 = `License Plate(s)/State (show each unit):`;
        const truckInputWidth = 75; 
        doc.rect(outlinedInputStartX, row3Y - inputFieldHeight * 0.7, truckInputWidth, inputFieldHeight); 
        doc.text(truckLabelLine1, outlinedInputStartX + truckInputWidth / 2, row3Y + labelVerticalOffset, { align: 'center' });
        doc.text(truckLabelLine2, outlinedInputStartX + truckInputWidth / 2, row3Y + labelVerticalOffset + truckLabelOffsetBelowBox, { align: 'center' });
        
        // Right: Main Office Address (dash input with label below)
        const officeAddressLabel = 'Main Office Address';
        const officeAddressDashY = row3Y; 
        doc.setLineWidth(thinDashLineWidth); 
        doc.line(col2StartX, officeAddressDashY, col2StartX + dashInputLength, officeAddressDashY); 
        doc.text(officeAddressLabel, col2StartX + dashInputLength / 2, officeAddressDashY + labelVerticalOffset, { align: 'center' }); 
        
        nextY = row3Y + inputFieldHeight * 0.7 + labelVerticalOffset + truckLabelOffsetBelowBox ; 

        // Row 4: Home Terminal Address (right)
        let row4Y = nextY;

        // Right: Home Terminal Address (dash input with label below)
        const homeTerminalLabel = 'Home Terminal Address';
        const homeTerminalDashY = row4Y; 
        doc.setLineWidth(thinDashLineWidth); 
        doc.line(col2StartX, homeTerminalDashY, col2StartX + dashInputLength, homeTerminalDashY); 
        doc.text(homeTerminalLabel, col2StartX + dashInputLength / 2, homeTerminalDashY + labelVerticalOffset, { align: 'center' }); 
        
        currentY = row4Y + inputFieldHeight * 0.7 + labelVerticalOffset + 5; 

        currentY += 2; 

        // --- Grid Setup (already good, just adjusting currentY start) ---
        doc.setLineWidth(0.2); 
        const gridStartX = marginX;
        const gridTopPadding = 8; 
        const gridStartY = currentY + gridTopPadding; 
        const timeLabelWidth = 25; 
        const totalColumnWidth = 18; 
        const timelineActiveWidth = pageWidth - marginX * 2 - timeLabelWidth - totalColumnWidth; 
        const hourColumnWidth = timelineActiveWidth / 24;
        const rowHeight = 10;
        const timelineLineHeight = 1.5;

        const dutyStatusLabels = [
            ['OFF', 'DUTY'], 
            ['SLEEPER', 'BERTH'], 
            ['DRIVING'], 
            ['ON DUTY', '(NOT DRIVING)']
        ];
        const totalDutyStatusRowsHeight = rowHeight * dutyStatusLabels.length;
        const gridBottomY = gridStartY + totalDutyStatusRowsHeight;

        const summaries = calculateDailySummaries(logs);

        doc.setFontSize(8);
        doc.text('TIME', gridStartX + timeLabelWidth + (timelineActiveWidth / 2), gridStartY - gridTopPadding + 2, { align: 'center' });
        
        const totalColumnStartX = gridStartX + timeLabelWidth + timelineActiveWidth;
        doc.text('TOTAL', totalColumnStartX + (totalColumnWidth / 2), gridStartY - gridTopPadding + 2, { align: 'center' });


        doc.setDrawColor(0); 
        doc.setLineWidth(0.2); 

        for (let i = 0; i < 24; i++) {
            const hourX = gridStartX + timeLabelWidth + (i * hourColumnWidth);
            doc.text(String(i).padStart(2, '0'), hourX, gridStartY - 2, { align: 'center' }); 
            doc.line(hourX, gridStartY, hourX, gridBottomY); 
        }
        doc.line(gridStartX + timeLabelWidth + timelineActiveWidth, gridStartY, gridStartX + timeLabelWidth + timelineActiveWidth, gridBottomY);

        doc.line(totalColumnStartX + totalColumnWidth, gridStartY, totalColumnStartX + totalColumnWidth, gridBottomY);

        doc.line(gridStartX + timeLabelWidth, gridStartY, pageWidth - marginX, gridStartY);

        doc.rect(gridStartX, gridStartY, pageWidth - marginX * 2, totalDutyStatusRowsHeight);


        currentY = gridStartY; 

        const dutyStatusMap = {
            'OFF,DUTY': 0, 
            'SLEEPER,BERTH': 1,
            'DRIVING': 2,
            'ON DUTY,(NOT DRIVING)': 3,
        };

        const summaryDataMap = {
            'OFF,DUTY': summaries.totalOffDuty,
            'SLEEPER,BERTH': summaries.totalSleeperBerth,
            'DRIVING': summaries.totalDriving,
            'ON DUTY,(NOT DRIVING)': summaries.totalOnDutyNotDriving,
        };


        dutyStatusLabels.forEach((labelArray, index) => {
            const rowY = currentY + (rowHeight * index);
            doc.setFontSize(8);
            
            const textHeight = labelArray.length * doc.getLineHeight() / doc.internal.scaleFactor;
            const textStartY = rowY + (rowHeight / 2) - (textHeight / 2) + (doc.getLineHeight() / (2 * doc.internal.scaleFactor)); 
            
            labelArray.forEach((line, lineIndex) => {
                doc.text(line, gridStartX + 2, textStartY + (lineIndex * doc.getLineHeight() / doc.internal.scaleFactor), { align: 'left' });
            });


            doc.line(gridStartX + timeLabelWidth, rowY, pageWidth - marginX, rowY);

            doc.setDrawColor(150); 
            doc.setLineWidth(0.1); 

            for (let i = 0; i < 24; i++) {
                const hourX = gridStartX + timeLabelWidth + (i * hourColumnWidth);
                const cellTopY = rowY;

                doc.line(hourX + (hourColumnWidth / 4), cellTopY, hourX + (hourColumnWidth / 4), cellTopY + (rowHeight * 0.3));
                doc.line(hourX + (hourColumnWidth * 3 / 4), cellTopY, hourX + (hourColumnWidth * 3 / 4), cellTopY + (rowHeight * 0.3));

                doc.line(hourX + (hourColumnWidth / 2), cellTopY, hourX + (hourColumnWidth / 2), cellTopY + (rowHeight * 0.6));
            }
            doc.setDrawColor(0); 
            doc.setLineWidth(0.2); 

            const mapKey = labelArray.join(','); 
            const totalHours = summaryDataMap[mapKey];
            if (totalHours !== undefined) { 
                doc.setFontSize(8);
                doc.text(`${totalHours}`, totalColumnStartX + (totalColumnWidth / 2), rowY + rowHeight / 2 + 2, { align: 'center' });
            }
        });
        doc.line(gridStartX + timeLabelWidth, gridBottomY, pageWidth - marginX, gridBottomY);


        // --- Draw the Continuous Duty Status Line ---
        doc.setDrawColor(0); 
        doc.setLineWidth(timelineLineHeight); 

        const dailyStartMs = new Date(date).setHours(0, 0, 0, 0); 
        const timelineStartX = gridStartX + timeLabelWidth; 
        const endOfDayX = timelineStartX + timelineActiveWidth; 

        const sortedLogs = [...logs].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        let previousX = timelineStartX;
        let previousY = currentY + (rowHeight * dutyStatusMap['OFF,DUTY']) + (rowHeight / 2);

        if (sortedLogs.length > 0) {
            const firstLog = sortedLogs[0];
            const firstLogStartMs = new Date(firstLog.start_time).getTime();
            const firstLogStartMinute = (firstLogStartMs - dailyStartMs) / (1000 * 60);
            const firstLogStartX = timelineStartX + (firstLogStartMinute / 1440) * timelineActiveWidth;
            
            let firstLogStatusKey = firstLog.status;
            if (firstLog.status === 'OFF_DUTY') firstLogStatusKey = 'OFF,DUTY';
            if (firstLog.status === 'SLEEPER_BERTH') firstLogStatusKey = 'SLEEPER,BERTH';
            if (firstLog.status === 'ON_DUTY_NOT_DRIVING') firstLogStatusKey = 'ON DUTY,(NOT DRIVING)';

            const firstLogY = currentY + (rowHeight * dutyStatusMap[firstLogStatusKey]) + (rowHeight / 2);

            // If the first log doesn't start exactly at midnight off-duty, draw a line from midnight to its start
            if (firstLogStartMinute > 0 || firstLog.status !== 'OFF_DUTY') {
                doc.line(previousX, previousY, firstLogStartX, previousY); // Horizontal line until first log start
                doc.line(firstLogStartX, previousY, firstLogStartX, firstLogY); // Vertical line to first log status
                previousX = firstLogStartX;
                previousY = firstLogY;
            }
        }

        sortedLogs.forEach((log) => {
            const start = new Date(log.start_time);
            const end = new Date(log.end_time);

            const startMinuteOfDay = (start.getTime() - dailyStartMs) / (1000 * 60);
            const endMinuteOfDay = (end.getTime() - dailyStartMs) / (1000 * 60); // Corrected calculation here

            let currentX1 = timelineStartX + (Math.max(0, startMinuteOfDay) / 1440) * timelineActiveWidth;
            let currentX2 = timelineStartX + (Math.min(1440, endMinuteOfDay) / 1440) * timelineActiveWidth;

            let logStatusKey = log.status;
            if (log.status === 'OFF_DUTY') logStatusKey = 'OFF,DUTY';
            if (log.status === 'SLEEPER_BERTH') logStatusKey = 'SLEEPER,BERTH';
            if (log.status === 'ON_DUTY_NOT_DRIVING') logStatusKey = 'ON DUTY,(NOT DRIVING)';

            const statusIndex = dutyStatusMap[logStatusKey];
            if (statusIndex === undefined) {
                console.warn(`Attempted to draw log with unknown status or malformed status key: ${log.status}. Skipping.`);
                return;
            }
            const yCurrent = currentY + (rowHeight * statusIndex) + (rowHeight / 2);

            // Draw vertical line if status changed or there was a gap
            if (Math.abs(previousX - currentX1) > 0.01 || previousY !== yCurrent) {
                doc.line(previousX, previousY, currentX1, previousY); // Horizontal line to new start time
                doc.line(currentX1, previousY, currentX1, yCurrent); // Vertical line to new status level
            }

            // Draw horizontal line for the duration of the log entry
            doc.line(currentX1, yCurrent, currentX2, yCurrent);

            previousX = currentX2;
            previousY = yCurrent;

            // --- Add Details (Location, Odometer) ---
            doc.setFontSize(7);
            doc.setTextColor(50, 50, 50); // Slightly grey for details
            if (log.location) {
                doc.text(`Loc: ${log.location}`, currentX1 + 2, yCurrent + 4);
            }
            if (log.odometer_reading) {
                doc.text(`Odo: ${log.odometer_reading}`, currentX1 + 2, yCurrent + 8);
            }
            doc.setTextColor(0); // Reset text color to black
        });

        // Draw line from the last log entry to the end of the day (if not already there)
        if (previousX < endOfDayX) {
            doc.line(previousX, previousY, endOfDayX, previousY);
        }

        // --- Remarks Section (with border) ---
        const remarksSectionStartX = marginX;
        const remarksSectionEndX = pageWidth - marginX;
        
        // Define the top of the entire bordered section, slightly above "Remarks:" label
        let remarksContentTopY = gridBottomY + 10; 
        const remarksBorderTopY = remarksContentTopY - 5; 

        // Start drawing "Remarks:" label
        doc.setFontSize(10);
        doc.text('Remarks:', remarksSectionStartX + 2, remarksContentTopY + 5);

        let dynamicRemarksCurrentY = remarksContentTopY + 12; // Starting Y for dynamic remarks
        // Filter and display specific types of log entries as remarks
        logs.filter(log => ['fuel', 'rest'].includes(log.type)).forEach(event => {
            doc.setFontSize(8);
            const time = new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            doc.text(`${event.type.toUpperCase()} at ${time}: ${event.location || ''}`, remarksSectionStartX + 5, dynamicRemarksCurrentY);
            dynamicRemarksCurrentY += 5;
        });

        // Determine the Y position after dynamic remarks. Ensure a minimum height for the remarks box.
        const minimumRemarksHeight = 30; // Increased minimum height for the box
        let yAfterRemarksText = Math.max(remarksContentTopY + minimumRemarksHeight, dynamicRemarksCurrentY + 5); // +5 for padding after last dynamic remark if any

        const sectionPadding = 7; // Increased padding between content blocks within this section
        
        // Shipping Documents
        doc.setFontSize(10);
        const shippingDocsLabel = 'Shipping Documents: DVL or Manifest No. or';
        doc.text(shippingDocsLabel, remarksSectionStartX, yAfterRemarksText);
        doc.setLineWidth(thinDashLineWidth); 
        doc.line(remarksSectionStartX, yAfterRemarksText + labelVerticalOffset, remarksSectionStartX + dashInputLength, yAfterRemarksText + labelVerticalOffset); 
        yAfterRemarksText += inputLineHeight + sectionPadding;

        // Shipper & Commodity
        const shipperCommodityLabel = 'Shipper & Commodity:';
        doc.text(shipperCommodityLabel, remarksSectionStartX, yAfterRemarksText);
        doc.setLineWidth(thinDashLineWidth); 
        doc.line(remarksSectionStartX, yAfterRemarksText + labelVerticalOffset, remarksSectionStartX + dashInputLength, yAfterRemarksText + labelVerticalOffset); 
        yAfterRemarksText += inputLineHeight + sectionPadding; 

        // "Enter name of place you reported..." section
        doc.setFontSize(8);
        doc.text('Enter name of place you reported and where released from work and when and where each change of duty occurred.', remarksSectionStartX + 2, yAfterRemarksText + 5);
        yAfterRemarksText += 15; // Adjusted height for the "Enter name of place..." text, excluding "Use time standard..."

        // Now draw the left and bottom border for the entire "Remarks" section
        doc.setLineWidth(0.5); // Slightly thicker border
        doc.setDrawColor(0); // Black color

        const remarksSectionBottomY = yAfterRemarksText + 5; // The bottom of the last content block, with some padding

        // Left Border
        doc.line(remarksSectionStartX, remarksBorderTopY, remarksSectionStartX, remarksSectionBottomY);

        // Split Bottom Border
        const centerRemarksX = remarksSectionStartX + (remarksSectionEndX - remarksSectionStartX) / 2;
        const gapWidthForText = 70; // Adjust as needed for the text width
        const bottomLine1EndX = centerRemarksX - (gapWidthForText / 2);
        const bottomLine2StartX = centerRemarksX + (gapWidthForText / 2);

        doc.line(remarksSectionStartX, remarksSectionBottomY, bottomLine1EndX, remarksSectionBottomY); // First part of bottom border
        doc.line(bottomLine2StartX, remarksSectionBottomY, remarksSectionEndX, remarksSectionBottomY); // Second part of bottom border

        // Add text "Use time standard of home terminal." between the split border
        doc.setFontSize(8);
        doc.text('Use time standard of home terminal.', centerRemarksX, remarksSectionBottomY - 1, { align: 'center' }); // Position text slightly above the split


        // Update currentY for elements *after* this entire bordered section
        currentY = remarksSectionBottomY; // Increased spacing after the split border text


        // --- Recap: Complete at end of day section (New Columnar Layout) ---
        const recapSectionTopY = currentY;
        const recapSectionHeight = 45; // Fixed height for the entire recap area

        const totalRecapWidth = pageWidth - marginX * 2;
        const columnGap = 1; // Small gap between columns

        // Define specific widths for each column, adjusting to make the last one thinner
        const col4WidthFixed = 15; // Explicitly smaller width for the last column
        const remainingWidthForFirstThree = totalRecapWidth - col4WidthFixed - (3 * columnGap);
        
        // Distribute remaining width among the first three columns, giving column 1 slightly more room
        const col1Width = remainingWidthForFirstThree * 0.20;
        const col2Width = remainingWidthForFirstThree * 0.40;
        const col3Width = remainingWidthForFirstThree * 0.40;

        const col1X = marginX;
        const col2X = col1X + col1Width + columnGap;
        const col3X = col2X + col2Width + columnGap;
        const col4X = col3X + col3Width + columnGap;

        // Common Y-coordinate for all dashes
        const commonDashY = recapSectionTopY + 20; 
        const valueDashLength = 12; // Fixed length for the dash next to the value
        const dashSpacing = 3; // Space between individual dashes (A, B, C)
        const labelToDashOffset = -1; // Horizontal offset from label to dash

        doc.setLineWidth(thinDashLineWidth); // Set line width for dashes

        // Adjust recap section layout for rules labels to be on the left of their dashes
        const recapRuleLabelColWidth = 10; // Width for "70 Hour / 8 Day Drivers" etc.
        const recapDashesBlockPadding = 1; // Padding between rule label and dashes block
        const approxLineHeight = doc.getTextDimensions('M').h; 

        // Column 1: "Recap: Complete at end of day" (Label, Dash, Description)
        const col1RuleLabelX = col1X;
        const col1DashesBlockStartX = col1X + recapRuleLabelColWidth + recapDashesBlockPadding;

        doc.setFontSize(7);
        const recapLabel = 'Recap: Complete at end of day';
        const recapLabelLines = doc.splitTextToSize(recapLabel, recapRuleLabelColWidth - 2); 
        const recapLabelTotalHeight = approxLineHeight * recapLabelLines.length;
        const recapLabelY = commonDashY - (recapLabelTotalHeight / 2) + (approxLineHeight / 2);

        recapLabelLines.forEach((line, index) => {
            doc.text(line, col1RuleLabelX, recapLabelY + (index * approxLineHeight), { align: 'left' });
        });

        // Dash for Column 1 
        doc.line(col1DashesBlockStartX, commonDashY, col1DashesBlockStartX + valueDashLength, commonDashY); 

        // Description below dash for Column 1
        doc.setFontSize(7);
        const onDutyLabel = 'On duty hours today, lines 3 & 4';
        const onDutyLabelLines = doc.splitTextToSize(onDutyLabel, col1Width - recapRuleLabelColWidth - recapDashesBlockPadding); 
        doc.text(onDutyLabelLines, col1DashesBlockStartX + valueDashLength / 2, commonDashY + 5, { align: 'center' });


        // Column 2: "70 Hour / 8 Day Drivers" (Label, A/B/C Dashes, Descriptions)
        const col2RuleLabelX = col2X;
        const col2DashesBlockStartX = col2X + recapRuleLabelColWidth + recapDashesBlockPadding;

        doc.setFontSize(7);
        const driver70HourLabel = ['70 Hour /', '8 Day', 'Drivers'];
        const driver70HourLabelTotalHeight = approxLineHeight * driver70HourLabel.length; 
        const driver70HourLabelY = commonDashY - (driver70HourLabelTotalHeight / 2) + (approxLineHeight / 2);

        driver70HourLabel.forEach((line, index) => {
            doc.text(line, col2RuleLabelX, driver70HourLabelY + (index * approxLineHeight), { align: 'left' });
        });

        const labels70_8 = [
            ['A Total', 'hours on', 'duty last 7', 'days,', 'including', 'today.'],
            ['B. Total', 'hours', 'available', 'tomorror', '70hr.', 'minus A.'], 
            ['C. Total', 'hours on', 'duty last 5', 'days', 'including', 'today']
        ];
        
        // Positioning for A, B, C dashes in Column 2
        const totalDashesWidth = (valueDashLength * 3) + (dashSpacing * 2);
        let currentDashBlockStartX2 = col2DashesBlockStartX; 

        for (let i = 0; i < 3; i++) {
            const currentDashStartX = currentDashBlockStartX2 + (i * (valueDashLength + dashSpacing));
            const currentDashEndX = currentDashStartX + valueDashLength;

            doc.setFontSize(8);
            doc.text(String.fromCharCode(65 + i), currentDashStartX - labelToDashOffset, commonDashY, { align: 'right' }); 
            
            doc.line(currentDashStartX, commonDashY, currentDashEndX, commonDashY);
            
            doc.setFontSize(6); 
            let labelLines = doc.splitTextToSize(labels70_8[i], valueDashLength + 2); 
            doc.text(labelLines, currentDashStartX + valueDashLength / 2, commonDashY + 5, { align: 'center' }); 
        }

        // Column 3: "60 Hour / 7 Day Drivers" (Label, A/B/C Dashes, Descriptions)
        const col3RuleLabelX = col3X;
        const col3DashesBlockStartX = col3X + recapRuleLabelColWidth + recapDashesBlockPadding;

        doc.setFontSize(7);
        const driver60HourLabel = ['60 Hour /', '7 Day', 'Drivers'];
        const driver60HourLabelTotalHeight = approxLineHeight * driver60HourLabel.length; 
        const driver60HourLabelY = commonDashY - (driver60HourLabelTotalHeight / 2) + (approxLineHeight / 2);

        driver60HourLabel.forEach((line, index) => {
            doc.text(line, col3RuleLabelX, driver60HourLabelY + (index * approxLineHeight), { align: 'left' });
        });

        const labels60_7 = [
            ['A Total', 'hours on', 'duty last 6', 'days,', 'including', 'today.'],
            ['B. Total', 'hours', 'available', 'tomorror', '60hr.', 'minus A.'], 
            ['C. Total', 'hours on', 'duty last 7', 'days', 'including', 'today']
        ];

        // Positioning for A, B, C dashes in Column 3
        let currentDashBlockStartX3 = col3DashesBlockStartX; 

        for (let i = 0; i < 3; i++) {
            const currentDashStartX = currentDashBlockStartX3 + (i * (valueDashLength + dashSpacing));
            const currentDashEndX = currentDashStartX + valueDashLength;

            doc.setFontSize(8);
            doc.text(String.fromCharCode(65 + i), currentDashStartX - labelToDashOffset, commonDashY, { align: 'right' }); 
            
            doc.line(currentDashStartX, commonDashY, currentDashEndX, commonDashY);
            
            doc.setFontSize(6); 
            let labelLines = doc.splitTextToSize(labels60_7[i], valueDashLength + 2); 
            doc.text(labelLines, currentDashStartX + valueDashLength / 2, commonDashY + 5, { align: 'center' }); 
        }

        // Column 4: "If you took 34 consecutive hours off duty..." text
        doc.setFontSize(6); 
        const ifYouTookText = "If you took 34 consecutive hours off duty you have 60/70 hours available.";
        const ifYouTookLines = doc.splitTextToSize(ifYouTookText, col4WidthFixed - 4); 
        doc.text(ifYouTookLines, col4X + col4WidthFixed / 2, recapSectionTopY + 10, { align: 'center' }); 


        currentY = recapSectionTopY + recapSectionHeight + 10; 

        // Sanitize the date for use in a filename (remove slashes, etc.)
        const safeDate = date.replace(/[^a-zA-Z0-9-]/g, '_');
        doc.save(`ELD_Daily_Log_${safeDate}.pdf`);
    }, [calculateDailySummaries]); // Dependencies for handleGeneratePdf

    // useEffect to fetch logs from the API
    useEffect(() => {
        const fetchLogs = async () => {
            if (!tripId) {
                setError("Trip ID is missing. Cannot fetch logs.");
                setLoading(false);
                setDailyLogs(null); // Clear previous logs
                return;
            }

            setLoading(true);
            setError(null); // Clear previous errors
            try {
                // Ensure this URL is correct for your backend API
                const response = await fetch(`${backendApiUrl}trips/${tripId}/logs/`);
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error(`Logs not found for Trip ID: ${tripId}.`);
                    }
                    throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
                }
                const data = await response.json();
                
                // It's crucial that 'data' is an object where keys are dates
                // For example: { "2025-06-10": [...logs], "2025-06-11": [...logs] }
                if (Object.keys(data).length === 0) {
                    // If no logs are returned or data is an empty array/object
                    setDailyLogs({});
                } else {
                    setDailyLogs(data);
                }
            } catch (err) {
                console.error("Failed to fetch logs:", err);
                setError(`Failed to load ELD logs: ${err.message}. Please check your backend and network connection.`);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
        // Add all state setters to dependency array to satisfy ESLint hooks rules,
        // though typically `setDailyLogs`, `setLoading`, `setError` are stable
    }, [tripId, setLoading, setError, setDailyLogs]);

    // Conditional rendering based on loading, error, and dailyLogs state
    if (loading) {
        return <p>Loading ELD logs...</p>;
    }

    if (error) {
        return <p className="error-message">Error: {error}</p>;
    }

    // If dailyLogs is null or an empty object, display a message
    if (!dailyLogs || Object.keys(dailyLogs).length === 0) {
        return <p>No ELD logs available for this trip yet or an error occurred.</p>;
    }

    return (
        <div className="log-sheets-container">
            <h2>Generate Daily ELD Logs (PDF)</h2>
            <p>Select a date below to generate its PDF log sheet:</p>
            {/*
                This section maps over the dailyLogs object to create a button for each date.
                dailyLogs is expected to be an object like:
                {
                    "YYYY-MM-DD": [ {log_entry_1}, {log_entry_2}, ... ],
                    "YYYY-MM-DD": [ {log_entry_A}, {log_entry_B}, ... ],
                    ...
                }
            */}
            {Object.entries(dailyLogs).map(([date, logs]) => (
                <div key={date} className="log-entry-preview">
                    <h3>Log for: {date}</h3>
                    <button onClick={() => handleGeneratePdf(date, logs)} className="generate-pdf-button">
                        Generate PDF for {date}
                    </button>
                </div>
            ))}
        </div>
    );
}

export default LogSheetDisplay;