import React, { useEffect, useRef, useState, useContext } from 'react';
import { v4 as uuid } from 'uuid';
import Cookies from 'universal-cookie';
import { ChatbotContext } from '../../context/ChatbotContext';
import { MdClose, MdSend } from 'react-icons/md';
import { FaUserGraduate } from 'react-icons/fa';

import Message from './Message';
import Card from './Card';
import chathead from '../../assets/Anna_Chathead.svg';
import chatloading from '../../assets/chatbot-loading.gif';
import chatbotAvatar from '../../assets/Anna_Chat_Avatar.svg';
import QuickReplies from './QuickReplies';
import Modal from '../Modal';
import RecommendedCoursesMessage from './RecommendedCoursesMessage';
import RecommendedCoursesQuickReply from './RecommendedCoursesQuickReply';
import { titleCase } from '../../utils/utilityFunctions';

import '../../styles/chatbot.css';

const cookies = new Cookies();

const Chatbot = () => {
   const [messages, setMessages] = useState([
      {
         speaks: 'bot',
         keyword: 'terms-conditions',
         msg: {
            text: {
               text: 'Hello. Before we begin, in this session I will take your basic information. You must first read and agreed on the terms presented in the',
            },
         },
      },
   ]);
   const [textMessage, setTextMessage] = useState('');
   const {
      isAgreeTermsConditions,
      setIsAgreeTermsConditions,
      showBot,
      setShowbot,
      disabledInput,
      botChatLoading,
      setBotChatLoading,
      basis,
      setBasis,
      setIsRecommendationProvided,
   } = useContext(ChatbotContext);

   const messagesRef = useRef(null);
   const [user, setUser] = useState({ name: '', age: '', sex: '', strand: '' });
   const [riasec, setRiasec] = useState({ realistic: 0, investigative: 0, artistic: 0, social: 0, enterprising: 0, conventional: 0 });
   const [riasecCode, setRiasecCode] = useState([]);
   const [fallbackCount, setFallbackCount] = useState({});
   const [endConversation, setEndConversation] = useState(false);

   // recommeded courses
   const [knownCourses, setKnownCourses] = useState([]);
   const [riasecBasedRecommendedCourses, setRiasecBasedRecommendedCourses] = useState([]);
   const [strandBasedRecommendedCourses, setStrandBasedRecommendedCourses] = useState([]);

   // if cookies does not exist set cookies else do nothing, cookies path = '/ - accessible to all pages
   if (!cookies.get('userId')) cookies.set('userId', uuid(), { path: '/' });

   const df_text_query = async (text, parameters) => {
      let userSays = {
         speaks: 'user',
         msg: {
            text: {
               text: text,
            },
         },
      };

      setMessages(prev => [...prev, userSays]);
      setBotChatLoading(true);

      try {
         const body = { text, userId: cookies.get('userId'), parameters };
         const response = await fetch('/api/df_text_query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
         });
         const data = await response.json();
         setBotChatLoading(false);
         console.dir(data);

         // provide message if response status 200, elese need to add chatbot message if server error 500

         if (data) {
            if (data.intent && data.intent.displayName === 'Default Welcome Intent') {
               clearState();
            } else if (endConversation) {
               // trigger if the conversation was ended because of fallback exceed trigger limit
               df_event_query('FALLBACK_EXCEED_TRIGGER_LIMIT');
            } else if (data.intent && data.intent.isFallback) {
               // set fallbackCount if fallback is trigger
               const intentName = data.intent.displayName;
               if (fallbackCount[`${intentName}`] >= 5) {
                  console.log('fallbackCount = ', fallbackCount[`${intentName}`]);
                  df_event_query('FALLBACK_EXCEED_TRIGGER_LIMIT');
                  clearState();
                  setEndConversation(true);
                  return;
               }

               // object intent name does not exist assign 1 else if exisit just increment by 1
               if (!fallbackCount[`${intentName}`]) setFallbackCount(prev => ({ ...prev, [intentName]: 1 }));
               else setFallbackCount(prev => ({ ...prev, [intentName]: prev[`${intentName}`] + 1 }));
            }

            if (data.parameters.fields) {
               // get parameters data and set it to state
               const fields = data.parameters.fields;
               if (fields.name) setUser(prev => ({ ...prev, name: fields.name.stringValue }));
               else if (fields.age) setUser(prev => ({ ...prev, age: fields.age.numberValue }));
               else if (fields.sex) setUser(prev => ({ ...prev, sex: fields.sex.stringValue }));
               else if (fields.strand) setUser(prev => ({ ...prev, strand: fields.strand.stringValue }));
            }
         } else {
            const botSays = {
               speaks: 'bot',
               msg: {
                  text: {
                     text: 'Sorry. I am having trouble ????. I need to terminate. Will be back later.',
                  },
               },
            };
            setMessages(prev => [...prev, botSays]);
         }

         data.fulfillmentMessages.forEach(async msg => {
            const botSays = {
               speaks: 'bot',
               msg: msg,
            };
            setMessages(prev => [...prev, botSays]);

            // trigger something based on the payload sent by dialogflow
            if (msg.payload && msg.payload.fields && msg.payload.fields.riasec) {
               const riasecValue = msg.payload.fields.riasec.stringValue;
               switch (riasecValue) {
                  case 'realistic':
                     setRiasec(prev => ({ ...prev, realistic: prev.realistic + 1 }));
                     break;
                  case 'investigative':
                     setRiasec(prev => ({ ...prev, investigative: prev.investigative + 1 }));
                     break;
                  case 'artistic':
                     setRiasec(prev => ({ ...prev, artistic: prev.artistic + 1 }));
                     break;
                  case 'social':
                     setRiasec(prev => ({ ...prev, social: prev.social + 1 }));
                     break;
                  case 'enterprising':
                     if (msg.payload.fields.riasec_last_question) {
                        // trigger to get the up to date value of riasec with out waiting for the state to finish
                        // because triggering the handleRiasecRecommendation() will not able to get the updated value of riasec state
                        // applies only for enterprising since its the last question
                        handleRiasecRecommendation({ ...riasec, enterprising: riasec.enterprising + 1 });
                     }
                     setRiasec(prev => ({ ...prev, enterprising: prev.enterprising + 1 }));
                     break;
                  case 'conventional':
                     setRiasec(prev => ({ ...prev, conventional: prev.conventional + 1 }));
                     break;
               }
            }
            if (msg.payload && msg.payload.fields && !msg.payload.fields.riasec && msg.payload.fields.riasec_last_question) {
               // trigger recommendation after last question and answer was "no"
               handleRiasecRecommendation(riasec);
            }
            if (msg.payload && msg.payload.fields && msg.payload.fields.iswant_strand_recommendation) {
               df_event_query('STRAND_RECOMMENDATION', { strand: user.strand });
               setIsRecommendationProvided(prev => ({ ...prev, strand: 'done' }));
            }
         });
      } catch (err) {
         console.log(err.message);

         setBotChatLoading(false);
         const botSays = {
            speaks: 'bot',
            msg: {
               text: {
                  text: 'Sorry. I am having trouble ????. I need to terminate. Will be back later.',
               },
            },
         };
         setMessages(prev => [...prev, botSays]);
      }
   };

   const df_event_query = async (event, parameters) => {
      try {
         setBotChatLoading(true);

         const body = { event, userId: cookies.get('userId'), parameters };
         const response = await fetch('/api/df_event_query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
         });
         const data = await response.json();
         setBotChatLoading(false);
         console.dir(data);

         //clear all state when welcome intent trigger
         if (data.intent && data.intent.displayName === 'Default Welcome Intent') {
            clearState();
         }

         data.fulfillmentMessages.forEach(async msg => {
            const botSays = {
               speaks: 'bot',
               msg: msg,
            };
            setMessages(prev => [...prev, botSays]);

            // trigger something based on the payload sent by dialogflow
            if (msg.payload && msg.payload.fields && msg.payload.fields.iswant_strand_recommendation) {
               df_event_query('STRAND_RECOMMENDATION', { strand: user.strand });
               setIsRecommendationProvided(prev => ({ ...prev, strand: 'done' }));
            }
            if (msg.payload && msg.payload.fields && msg.payload.fields.no_riasec_recommended_courses) {
               // trigger only when no riasec recommendation
               setIsRecommendationProvided(prev => ({ ...prev, riasec: '' }));
            }
            if (msg.payload && msg.payload.fields && msg.payload.fields.riasec_recommended_courses) {
               const recommendedCourses = msg.payload.fields.riasec_recommended_courses.listValue.values;
               setRiasecBasedRecommendedCourses(recommendedCourses.map(course => course.stringValue));
            }
            if (msg.payload && msg.payload.fields && msg.payload.fields.strand_recommended_courses) {
               const recommendedCourses = msg.payload.fields.strand_recommended_courses.listValue.values;
               setStrandBasedRecommendedCourses(recommendedCourses.map(course => course.stringValue));
            }
            if (msg.payload && msg.payload.fields && msg.payload.fields.end_conversation) {
               savedConversation(user, riasecCode, riasecBasedRecommendedCourses, strandBasedRecommendedCourses);
               clearState();
            }
         });
      } catch (err) {
         console.log(err.message);

         setBotChatLoading(false);
         const botSays = {
            speaks: 'bot',
            msg: {
               text: {
                  text: 'Sorry. I am having trouble ????. I need to terminate. Will be back later.',
               },
            },
         };

         setMessages(prev => [...prev, botSays]);
      }
   };

   const clearState = () => {
      setUser({ name: '', age: '', sex: '', strand: '' });
      setRiasec({ realistic: 0, investigative: 0, artistic: 0, social: 0, enterprising: 0, conventional: 0 });
      setRiasecCode([]);
      setKnownCourses([]);
      setRiasecBasedRecommendedCourses([]);
      setStrandBasedRecommendedCourses([]);
      setFallbackCount({});
      setEndConversation(false);
      setBasis('');
      setIsRecommendationProvided({ riasec: '', strand: '' });
   };

   const handleRiasecRecommendation = riasecScores => {
      const sortRiasec = Object.entries(riasecScores).sort(([, a], [, b]) => b - a);
      console.log('\nsort riasec = ', sortRiasec);
      const sameScore = sortRiasec.filter(el => sortRiasec[0][1] === el[1]);
      console.log('sameScore = ', sameScore);

      // sort the riasec
      // get the riasec areas where same as the  highes riasec score
      // if sameScore as highes score is > 3 then randomly select among those riasec areas, else get the top 3 from the sortRiasec
      let RIASEC_CODE = [];

      if (sameScore.length > 3) {
         // mag randomly pick among those highes riasec score as the RIASEC code
         for (let i = 1; i <= 3; i++) {
            const random = Math.floor(Math.random() * sameScore.length); // random index number based on the sameScore.length
            RIASEC_CODE.push(...sameScore.splice(random, 1)); // uses random delete which return a value -> to avoid duplicated value of RIASEC, then stored to new array
         }
      } else RIASEC_CODE = sortRiasec.slice(0, 3);

      console.log('RIASEC CODE = ', RIASEC_CODE);

      setRiasecCode(RIASEC_CODE);
      df_event_query('RIASEC_RECOMMENDATION', RIASEC_CODE);
      setIsRecommendationProvided(prev => ({ ...prev, riasec: 'done' }));
      // fetchCoursesByStrand();
   };

   const handleRecommendedCourseClick = course => {
      const allMessages = messages;
      let userSays = {
         speaks: 'user',
         msg: {
            text: {
               text: course,
            },
         },
      };

      // remove quick reply message
      messages.pop();
      setMessages([...allMessages, userSays]);
      if (!knownCourses.includes(course)) setKnownCourses(prev => [...prev, course]);

      if (basis === 'riasec') df_event_query('GET_RIASEC_RECOMMENDATION_COURSE_INFO', { course_to_lookup: course });
      else if (basis === 'strand') df_event_query('GET_STRAND_RECOMMENDATION_COURSE_INFO', { course_to_lookup: course });
   };

   const savedConversation = async (user, riasecCode, riasecCourses, strandCourses) => {
      try {
         const body = {
            name: titleCase(user.name),
            age: user.age,
            sex: user.sex,
            strand: user.strand,
            riasec_code: riasecCode,
            riasec_course_recommendation: riasecCourses,
            strand_course_recommendation: strandCourses,
         };

         const response = await fetch('/user/conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
         });
         const data = await response.json();
         if (response.status === 200) console.log(data.message);
      } catch (err) {
         console.error(err.message);
      }
   };

   const renderCards = cards => {
      return cards.map((card, i) => <Card key={i} payload={card.structValue} />);
   };

   const renderMessage = (message, i) => {
      if (message.msg && message.msg.text && message.msg.text.text) {
         return (
            <Message key={i} keyword={message.keyword} terms={message.terms && message.terms} speaks={message.speaks} text={message.msg.text.text} />
         );
      } else if (message.msg && message.msg.payload.fields.cards) {
         return (
            <div className='message-cards' key={i}>
               <img className='chatbot-avatar message-avatar' src={chatbotAvatar} alt='chathead' />
               <div className='cards'>
                  <div style={{ width: message.msg.payload.fields.cards.listValue.values.length * 270 }}>
                     {renderCards(message.msg.payload.fields.cards.listValue.values)}
                  </div>
               </div>
            </div>
         );
      } else if (
         message.msg &&
         message.msg.payload &&
         message.msg.payload.fields &&
         message.msg.payload.fields.quick_replies &&
         message.msg.payload.fields.basis &&
         message.msg.payload.fields.recommended_courses_info
      ) {
         return (
            <RecommendedCoursesQuickReply
               key={i}
               payload={message.msg.payload.fields.quick_replies.listValue.values}
               basis={message.msg.payload.fields.basis.stringValue}
            />
         );
      } else if (message.msg && message.msg.payload && message.msg.payload.fields && message.msg.payload.fields.quick_replies) {
         return (
            <QuickReplies
               key={i}
               messages={messages}
               setMessages={setMessages}
               replyClick={handleQuickReplyPayload}
               payload={message.msg.payload.fields.quick_replies.listValue.values}
            />
         );
      } else if (
         message.msg &&
         message.msg.payload &&
         message.msg.payload.fields &&
         message.msg.payload.fields.basis &&
         (message.msg.payload.fields.riasec_recommended_courses || message.msg.payload.fields.strand_recommended_courses)
      ) {
         return (
            <RecommendedCoursesMessage
               key={i}
               speaks={message.speaks}
               isRecommendationProvided
               handleMessagesScrollToBottom={handleMessagesScrollToBottom}
               dialogflowEventQuery={df_event_query}
               setTextMessage={setTextMessage}
               strand={user.strand}
               basis={message.msg.payload.fields.basis.stringValue}
               recommendedCourses={
                  message.msg.payload.fields.basis.stringValue === 'riasec'
                     ? message.msg.payload.fields.riasec_recommended_courses.listValue.values
                     : message.msg.payload.fields.strand_recommended_courses.listValue.values
               }
            />
         );
      }
   };

   const renderMessages = messages => {
      if (messages && messages.length > 0) {
         return messages.map((message, i) => {
            return renderMessage(message, i);
         });
      } else return null;
   };

   const send = e => {
      e.preventDefault();
      df_text_query(textMessage);
      setTextMessage('');
   };

   const handleMessagesScrollToBottom = () => {
      // element.scrollTop = element.scrollHeight - element is the container of message
      // for automatic scoll when new message -> messagesRef.current.scrollTop = messagesRef.current.scrollHeight
      // for smooth scrolling, added scroll-behavior: smooth in css for chatbot-messaes class
      // if (messagesRef.current) messagesRef.current.scrollIntoView({ behavior: 'smooth' });
      if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
   };

   const handleQuickReplyPayload = (e, payload, text) => {
      e.preventDefault(); // will only work for <a> tag or buttons submit
      e.stopPropagation(); // will only work for <a> tag or buttons submit

      let humanSays = {
         speaks: 'user',
         msg: {
            text: {
               text: text,
            },
         },
      };

      switch (payload) {
         case 'COURSE_OPTIONS_YES':
            setMessages(prev => [...prev, humanSays]);
            df_event_query('COURSE_OPTIONS_YES');
            break;

         case 'RIASEC_START':
            setMessages(prev => [...prev, humanSays]);
            df_event_query('RIASEC_START');
            break;

         case 'ISLEARN_RIASEC_RECOMMENDED_COURSES_YES':
            setMessages(prev => [...prev, humanSays]);
            df_event_query('ISLEARN_RIASEC_RECOMMENDED_COURSES_YES');
            break;

         case 'ISWANT_STRAND_RECOMMENDATION':
            setMessages(prev => [...prev, humanSays]);
            df_event_query('ISWANT_STRAND_RECOMMENDATION');
            break;

         case 'ISLEARN_STRAND_RECOMMENDED_COURSES_YES':
            setMessages(prev => [...prev, humanSays]);
            df_event_query('ISLEARN_STRAND_RECOMMENDED_COURSES_YES');
            break;

         case 'END_CONVERSATION':
            setMessages(prev => [...prev, humanSays]);
            df_event_query('END_CONVERSATION');
            break;

         default:
            df_text_query(text);
            break;
      }
   };

   const handleResolveAfterXSeconds = x => {
      setBotChatLoading(true);
      return new Promise(resolve => {
         setTimeout(() => {
            setBotChatLoading(false);
            resolve(x);
         }, x * 1000);
      });
   };

   const handleTermsConditionAgree = async () => {
      df_event_query('Welcome');
      setIsAgreeTermsConditions(true);
   };

   // const fetchCoursesByStrand = async () => {
   //    try {
   //       const response = await fetch(`/user/courses-by-strand/${user.strand}`);
   //       const data = await response.json();
   //       console.log(data);
   //       if (response.status === 200) setStrandBasedRecommendedCourses(data.courses);
   //    } catch (err) {
   //       console.error(err.message);
   //    }
   // };

   useEffect(() => {
      handleMessagesScrollToBottom();
   }, [messages, showBot]);

   useEffect(() => {
      if (cookies.get('termsCondition') !== '' && cookies.get('termsCondition') !== 'false') setIsAgreeTermsConditions(false);
      else setIsAgreeTermsConditions(true);
   }, []);

   return (
      <>
         {showBot ? (
            <div className='chatbot'>
               {/* chatbot header */}
               <div className='chatbot-header d-flex justify-content-between align-items-center bg-primary'>
                  <div>
                     <img className='chatbot-avatar' src={chathead} alt='chathead' />
                     <h2 className='ms-2 h6 d-inline custom-heading'>Anna</h2>
                  </div>
                  <MdClose className='chatbot-close' onClick={() => setShowbot(false)} />
               </div>
               {/* chatbot messages */}
               <div ref={messagesRef} className='chatbot-messages'>
                  {/* <button className='btn btn-primary' onClick={() => handleRiasecRecommendation(riasec)}>
                     Identify RIASEC Area
                  </button> */}

                  {renderMessages(messages)}
                  {/* <div ref={messageEnd}></div> */}
                  {botChatLoading && (
                     <div className='message bot'>
                        <div>
                           <img className='chatbot-avatar message-avatar' src={chatbotAvatar} alt='chathead' />
                        </div>
                        <div className='message-text bot'>
                           <img className='message-loading' src={chatloading} alt='loading' />
                        </div>
                     </div>
                  )}
               </div>
               {/* text-input */}
               <form className='chatbot-text-input' onSubmit={send}>
                  <input
                     disabled={!isAgreeTermsConditions || disabledInput ? true : false}
                     value={textMessage}
                     type='text'
                     placeholder='Your answer here...'
                     onChange={e => setTextMessage(e.target.value)}
                  />
                  <button className='btn p-0 chatbot-send' disabled={!textMessage ? true : false} type='submit'>
                     <MdSend className='chatbot-send text-primary' />
                  </button>
               </form>
            </div>
         ) : (
            <img className='chathead' src={chathead} alt='chathead' onClick={() => setShowbot(true)} />
         )}

         {/* terms & conditions modal */}
         <Modal title='Terms and Conditions' target='modal-terms-conditions' size='modal-lg'>
            <div className='p-2'>
               <p className='mb-1'>
                  As you converse with Anna, you are to agree to bounded by these terms and conditions: Your responses to Anna will be recorded and be
                  used for analysis. You agree that the information you provided in this study will include your basic information (Name, Age, Sex)
                  and senior high school strand for these information will be necessary for identification and for the recommendation of degree
                  programs.
               </p>
            </div>

            <div className='p-2'>
               <h1 className='h5 custom-heading text-primary'>CONFIDENTIALITY</h1>
               <p>
                  The information that Anna will be obtaining througout the conversation will remain confidential to protect your rights or welfare.
               </p>
               <p className='mb-1'>
                  RA 10173 or the Data Privacy Act protects individuals from unauthorized processing of personal information. To ensure that your
                  information protected, The researchers will follow this law to keep your information safe and confidential.
               </p>
            </div>

            <div className='p-2'>
               <h1 className='h5 custom-heading text-primary'>DEFINITIONS</h1>
               <p>
                  Throughout the conversation, Anna will be responding to possible jargons. To ensure that you understand Anna, the definition of
                  words will be provided:
               </p>
               <p className='mb-1'>
                  <span className='fw-bold'>Degree Program</span> - A class that a college of university offers to students. (Bachelor in science in
                  Information Technology, etc..)
               </p>
               <p className='mb-1'>
                  <span className='fw-bold'>RIASEC</span> - A personality test that asks about your interest, skills, ability, and aspirations which
                  will help you decide on what career to pursue based on these attributes.
               </p>
               <p className='mb-1'>
                  <span className='fw-bold'>Senior high school strand</span> - Disciplines that are offered by schools to senior high school students
                  that would prepare them for college.
               </p>
            </div>

            {!isAgreeTermsConditions && (
               <div className='form-check m-2'>
                  <input
                     className='form-check-input'
                     onChange={() => handleTermsConditionAgree()}
                     type='checkbox'
                     value=''
                     id='terms-conditions-check'
                  />
                  <label className='form-check-label fw-bold' htmlFor='terms-conditions-check'>
                     I Agree to the Terms and Conditions
                  </label>
               </div>
            )}

            <div className='mt-3 float-end'>
               <button className='btn btn-primary' data-bs-dismiss='modal'>
                  Close
               </button>
            </div>
         </Modal>

         <Modal
            title={`${basis === 'riasec' ? 'RIASEC' : 'Strand'} | Recommended Degree Programs`}
            target='modal-recommended-courses-info'
            size='modal-lg'
         >
            <div className='d-flex flex-column'>
               {basis === 'riasec'
                  ? riasecBasedRecommendedCourses.length > 0 &&
                    riasecBasedRecommendedCourses.map((course, i) => (
                       <div
                          key={i}
                          className={`course-recommendation border-bottom ${knownCourses.includes(course) ? 'active' : ''} `}
                          data-bs-dismiss='modal'
                          onClick={() => handleRecommendedCourseClick(course)}
                       >
                          <FaUserGraduate className='me-2' />
                          <span>{course}</span>
                       </div>
                    ))
                  : strandBasedRecommendedCourses.length > 0 &&
                    strandBasedRecommendedCourses.map((course, i) => (
                       <div
                          key={i}
                          className={`course-recommendation border-bottom ${knownCourses.includes(course) ? 'active' : ''} `}
                          data-bs-dismiss='modal'
                          onClick={() => handleRecommendedCourseClick(course)}
                       >
                          <FaUserGraduate className='me-2' />
                          <span>{course}</span>
                       </div>
                    ))}
            </div>
         </Modal>
      </>
   );
};

export default Chatbot;
