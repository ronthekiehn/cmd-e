import React, { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { createRoot } from 'react-dom/client';
import './index.css';

//const API_URL = 'http://localhost:8787'
const API_URL = 'https://gcal-proxy.ronthekiehn.workers.dev'

const QuickAddEvent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [recurrenceInput, setRecurrenceInput] = useState('');
  const [showRecurrenceInput, setShowRecurrenceInput] = useState(false);
  const mainInputRef = useRef(null);
  const recurrenceInputRef = useRef(null);
  const activeMessageInputRef = useRef(null);
  const [hasRecurrenceChanged, setHasRecurrenceChanged] = useState(false);

  // Track the active message input
  const handleMessageFocus = (index) => {
    activeMessageInputRef.current = index;
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Open modal with Ctrl/Cmd + E
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    const handleEscape = (e) => {
      if (isOpen && e.key === 'Escape') {
       handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (messages.length > 3){
      setError('Event Creation Failed');
      setMessages([]);
    };
  }, [messages])

  useEffect(() => {
    const handleTab = (e) => {
      if (isOpen && e.key === 'Tab') {
        e.preventDefault();
        setHasRecurrenceChanged(true); // Set to true only when user toggles
        setShowRecurrence(prev => !prev);
        
        if (showRecurrence) {
          // Closing recurrence
          setRecurrenceInput('');
          setShowRecurrenceInput(false);
          
          // Delay to let the UI update
          setTimeout(() => {
            if (messages.length > 0 && activeMessageInputRef.current !== null) {
              // Focus the last active message input
              const messageInputs = document.querySelectorAll('[data-message-input]');
              const activeInput = messageInputs[activeMessageInputRef.current];
              if (activeInput && !activeInput.disabled) {
                activeInput.focus();
              } else {
                mainInputRef.current?.focus();
              }
            } else {
              mainInputRef.current?.focus();
            }
          }, 50);
        } else {
          // Opening recurrence
          setTimeout(() => {
            setShowRecurrenceInput(true);
            // Longer delay for the recurrence input to be ready
            setTimeout(() => {
              recurrenceInputRef.current?.focus();
            }, 0);
          }, 100);
        }
      }
    };
    
    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [isOpen, showRecurrence, messages.length]);


  const parseJsonResponse = async (response) => {
    try {
      return await response.clone().json();
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      
      const text = await response.clone().text();
      console.log('Raw response:', text);
      
      // More aggressive cleaning - remove all backticks and 'json' markers
      const cleanedText = text
        .replace(/```json\s*/g, '')  // Remove opening ```json
        .replace(/```\s*$/g, '')     // Remove closing ```
        .replace(/^```|```$/g, '')   // Remove any remaining backticks
        .trim();
        
      console.log("Cleaned text:", cleanedText);
      
      try {
        return JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('Failed to parse cleaned JSON:', parseError);
        throw new Error('Failed to parse JSON');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    console.log(input + messages.map((message) => message.prepend + message.response).join(' '))

    try {
      // First, get event details
      const eventPromise = fetch(`${API_URL}/event`, {
        method: 'POST',
        body: JSON.stringify({
          input: input + messages.map((message) => message.prepend + message.response).join(' '),
          timestamp: new Date().toLocaleString()
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      let eventData;
      if (recurrenceInput) {
        const recurrencePromise = fetch(`${API_URL}/recurrence`, {
          method: 'POST',
          body: JSON.stringify({ 
        input: recurrenceInput,
        timestamp: new Date().toLocaleString()
          }),
          headers: { 'Content-Type': 'application/json' }
        });

        const [eventResponse, recurrenceResponse] = await Promise.all([eventPromise, recurrencePromise]);
        eventData = await parseJsonResponse(eventResponse);
        const recurrenceData = await parseJsonResponse(recurrenceResponse);
        eventData.Recurrence = recurrenceData;
      } else {
        const eventResponse = await eventPromise;
        eventData = await parseJsonResponse(eventResponse);
      }

      console.log('Event data:', eventData);
      console.log('Recurrence data:', eventData.Recurrence);
      
      if (messages.length > 0) {
        const newMessages = [...messages];
        newMessages.forEach(message => message.submitted = true);
        setMessages(newMessages);
      }
      if (!eventData) {
        throw new Error('Invalid event data received');
      }

      if (!eventData.Title ) {
        setMessages([...messages, {prepend: ' Title: ', question: 'Event Title', response: '', submitted: false}]);
        return;
      }

      if (!eventData.Start) {
        setMessages([...messages, {prepend: ' Starts at: ', question: 'Start Time', response: '',  submitted: false}]);
        return;
      }

      if (!eventData.End) {
        setMessages([...messages, {prepend: ' Ends at: ', question: 'End Time', response: '',  submitted: false}]);
        return;
      }


      let baseUrl = 'https://calendar.google.com/calendar/r/eventedit';
      let params = new URLSearchParams({
        text: eventData.Title,
        dates: `${eventData.Start.replace(/[-:]/g, '')}/${eventData.End?.replace(/[-:]/g, '') || eventData.Start.replace(/[-:]/g, '')}`,
        details: eventData.Other || ''
      });

      // Add recurrence parameters if present
      if (eventData.Recurrence?.freq) {
        const recur = ['RRULE:FREQ=' + eventData.Recurrence.freq];
        
        if (eventData.Recurrence.interval > 1) {
          recur[0] += `;INTERVAL=${eventData.Recurrence.interval}`;
        }
        if (eventData.Recurrence.count) {
          recur[0] += `;COUNT=${eventData.Recurrence.count}`;
        }
        if (eventData.Recurrence.until) {
          recur[0] += `;UNTIL=${eventData.Recurrence.until.replace(/[-:]/g, '')}`;
        }
        
        params.append('recur', recur.join(';'));
      }

      window.location.href = `${baseUrl}?${params.toString()}`;

      
      setInput('');
      setRecurrenceInput('');
      setShowRecurrence(false);
      setMessages([]);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to create event:', error);
      setError('Event creation failed');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const getOpacityClass = (index) => {
    // Map index to predefined opacity classes
    const opacityMap = {
      // Light Mode (bg-black/opacity)      // Dark Mode (bg-white/opacity)
      0: 'bg-[#D9D9D9] dark:bg-[#262626]',  // 15% opacity equivalent
      1: 'bg-[#CCCCCC] dark:bg-[#333333]',  // 20% opacity equivalent
      2: 'bg-[#BFBFBF] dark:bg-[#404040]',  // 25% opacity equivalent
      3: 'bg-[#B3B3B3] dark:bg-[#4D4D4D]',  // 30% opacity equivalent
    };
    return opacityMap[index] || 'bg-[#999999] dark:bg-[#666666]'; // 40% default
  };

  // Reset states when closing modal
  const handleClose = () => {
    setIsOpen(false);
    setError(null);
    setInput('');
    setMessages([]);
    setShowRecurrence(false);
    setShowRecurrenceInput(false);
    setRecurrenceInput('');
    setHasRecurrenceChanged(false); // Reset when modal closes
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Quick Add Event (Ctrl/Cmd + E)"
        className="cursor-pointer fixed bottom-10 right-10 z-50 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg transition-colors"
      >
        <Plus className="" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[6000]"
            onClick={handleClose}
          >
            <div className="fixed top-56 left-0 right-0">
                <div className="text-xs text-left text-[#808080] relative z-[7000] max-w-xl mx-auto mb-1 pl-6">
                    Press TAB to {showRecurrence ? 'remove' : 'add'} a recurrence
                </div>
              <form 
                onSubmit={handleSubmit} 
                disabled={loading || messages.length > 0}
                className={`bg-white px-2 dark:bg-black text-black dark:text-white max-w-xl mx-auto flex gap-2 ring-2 ring-blue-400 fullshadow min-h-[53px] relative z-[6001] justify-center ${
                  !hasRecurrenceChanged 
                    ? (showRecurrence ? 'h-[106px] rounded-xl' : 'h-[53px] rounded-full')
                    : (showRecurrence ? 'h-[106px] animate-to-rect' : 'h-[53px] animate-to-round')
                }`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  transition: 'height 100ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              > 
                <div className='relative w-full top-[8px]'>
                  <input
                    ref={mainInputRef}
                    type="text"
                    value={input}
                    onChange={(e) => {setInput(e.target.value); setMessages([])}}
                    placeholder="Add event (e.g. 'lunch on friday from 12-1)"
                    className="w-full px-4 py-[9.75px] focus:outline-none"
                    autoFocus
                  />
                  {showRecurrenceInput && (<>
                    <div className='absolute left-[16px] top-[45px] h-[1px] bg-[darkgray] w-9/10'></div>
                    <input
                      ref={recurrenceInputRef}
                      type="text"
                      value={recurrenceInput}
                      onChange={(e) => setRecurrenceInput(e.target.value)}
                      placeholder="Set recurrence (e.g. 'weekly until March 1')"
                      className=" absolute top-[53px] left-0 w-full px-4 py-[9.75px] focus:outline-none transition-opacity duration-100"
                    />
                  </>
                  )}
                </div>
                  <button
                    type="submit"
                    disabled={loading || messages.length > 0}
                    className="hover:bg-blue-400 disabled:bg-gray-300 dark:disabled:bg-gray-600 rounded-full p-2 flex items-center justify-center transition-colors cursor-pointer self-center"
                    style={{ display: messages.length > 0 ? 'none' : 'block' }}
                  >
                    <Plus className="" />
                  </button>

                  <div className="z-[6001] pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 max-w-xl w-full">
               
              </div>
              </form>
              {error && (
                <p className="fade-in absolute left-1/2 transform -translate-x-1/2 mt-3 text-center text-white bg-red-500 px-4 py-2 rounded-full text-sm z-[7000]">
                  {error}
                </p>
              )}

              <div className='absolute top-0 left-0 right-0 z-[7001] top-[20px] pointer-events-none'>
                <div className={`relative w-full mx-auto max-w-xl z-[7001] overflow-hidden pointer-events-none
                  ${
                    !hasRecurrenceChanged 
                      ? (showRecurrence ? 'h-[106px] rounded-xl' : 'h-[53px] rounded-full')
                      : (showRecurrence ? 'h-[106px] animate-to-rect' : 'h-[53px] animate-to-round')
                  }`}
                  style={{
                    transition: 'height 100ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}>
                {messages.map((message, index) => (
                  <form
                    key={index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: `${60 - (index * 15)}%`,
                      zIndex: 7000 + index,
                      
                    }}
                    className={`p-2 flex items-center text-sm min-h-[53px] fade-in pointer-events-auto ${getOpacityClass(index)} text-black dark:text-white h-[53px] rounded-l-full`}
                    onSubmit={(e) => {
                      handleSubmit(e);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between w-full">
                      <input
                        data-message-input
                        type="text"
                        value={message.response}
                        onChange={(e) => {
                          const newMessages = [...messages];
                          newMessages[index].response = e.target.value;
                          setMessages(newMessages);
                        }}
                        onFocus={() => handleMessageFocus(index)}
                        disabled={loading || message.submitted}
                        className="w-full px-4 py-2 rounded-full focus:outline-none"
                        placeholder={message.question}
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={loading || message.submitted}
                        className="hover:bg-blue-400 disabled:bg-gray-300 rounded-full p-2 flex items-center justify-center transition-colors cursor-pointer"
                        style={{ display: message.submitted > 0 ? 'none' : 'block' }}
                      >
                        <Plus className="" />
                      </button>
                    </div>
                  </form>
                ))}
                 </div> 
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

// Mount the component
const root = document.createElement("div");
root.id = "quick-add-calendar-root";
root.className = "gcal-quick-add";
document.body.appendChild(root);

createRoot(root).render(<QuickAddEvent />);

export default QuickAddEvent;