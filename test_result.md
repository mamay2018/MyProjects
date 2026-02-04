#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Build FollowUp Pro - a mobile app that helps service pros automatically follow up with leads via SMS + Email until the client replies or the lead is marked won/lost."

backend:
  - task: "User Authentication (signup/login)"
    implemented: true
    working: true
    file: "server.py, auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "JWT auth implemented with signup/login endpoints. Tested via curl - works correctly."

  - task: "Business Profile CRUD"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Create/Get/Update business profile works. Tested via curl."

  - task: "Lead Management CRUD"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Create/Read/Update/Delete leads implemented. Tested via curl."
      - working: true
        agent: "testing"
        comment: "Comprehensive testing completed. All CRUD operations working correctly: Create lead (POST /api/leads), Get leads list (GET /api/leads), Get single lead (GET /api/leads/{id}), Update lead (PUT /api/leads/{id}), Delete lead (DELETE /api/leads/{id}). Authentication, business association, and data validation all working properly."

  - task: "Sequence Management"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Built-in sequences seeded. Custom sequences can be created. Assign sequence to lead works."
      - working: true
        agent: "testing"
        comment: "Sequence management fully functional. GET /api/sequences returns 3 built-in sequences (Friendly, Professional, Urgent/Scarcity). Sequence assignment (POST /api/leads/{id}/assign-sequence) correctly changes lead status to FOLLOWING_UP and schedules follow-ups. All sequence operations working correctly."

  - task: "Follow-up Engine (Background Worker)"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "APScheduler job runs every minute. Finds leads with next_followup_at <= now. Sends messages via Twilio/SendGrid (MOCKED for now). Need to test full flow."
      - working: true
        agent: "testing"
        comment: "Background worker is functioning correctly. APScheduler is running and processing follow-ups. Confirmed MOCK SMS messages being sent in logs. Sequence assignment properly schedules next_followup_at timestamps. Status changes (WON/LOST/REPLIED) correctly stop automation by clearing next_followup_at and current_sequence_id."

  - task: "Twilio Webhook (Inbound SMS)"
    implemented: true
    working: false
    file: "server.py"
    stuck_count: 1
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Webhook endpoint /api/webhooks/twilio/sms implemented. Should match lead by phone and stop automation."
      - working: false
        agent: "testing"
        comment: "CRITICAL BUG: Webhook phone number matching is broken. The webhook normalizes incoming phone (+15557776666 -> 5557776666) but searches for leads using contains() against stored phone numbers that have dashes (555-777-6666). The search fails because '5557776666' is not contained in '555-777-6666'. This prevents inbound SMS from stopping automation. Fix needed: normalize phone numbers before storage OR normalize both sides during search."

  - task: "AI Message Rewrite"
    implemented: true
    working: true
    file: "services/ai_rewrite.py, server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "OpenAI integration via Emergent LLM key. Endpoint /api/ai/rewrite implemented."
      - working: true
        agent: "testing"
        comment: "AI rewrite functionality working correctly. POST /api/ai/rewrite successfully processes messages and returns rewritten versions using OpenAI via Emergent LLM key. Tested with professional tone and received properly formatted response."

  - task: "Dashboard Stats"
    implemented: true
    working: true
    file: "server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Returns todays_followups, hot_leads, pipeline_counts, money_at_risk. Tested via curl."

  - task: "Stripe Subscription"
    implemented: true
    working: true
    file: "services/stripe_service.py, server.py"
    stuck_count: 0
    priority: "low"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Checkout session and portal endpoints implemented. Webhook for subscription events implemented. Using MOCK mode since no real Stripe keys."
      - working: true
        agent: "testing"
        comment: "Stripe subscription endpoints are implemented and accessible. GET /api/subscription, POST /api/subscription/checkout, POST /api/subscription/portal, and POST /api/webhooks/stripe all respond correctly. Currently in MOCK mode due to test Stripe keys, which is expected for development environment."

frontend:
  - task: "Authentication Screens (Login/Signup)"
    implemented: true
    working: true
    file: "app/(auth)/login.tsx, app/(auth)/signup.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: "Clean UI with email/password forms. Screenshot verified."

  - task: "Business Onboarding Screen"
    implemented: true
    working: "NA"
    file: "app/onboarding.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Business setup form implemented."

  - task: "Dashboard Tab"
    implemented: true
    working: "NA"
    file: "app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Stats cards, pipeline overview, money at risk implemented."

  - task: "Leads Tab (List/Filter)"
    implemented: true
    working: "NA"
    file: "app/(tabs)/leads.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Lead list with status filters and search implemented."

  - task: "Lead Detail Screen"
    implemented: true
    working: "NA"
    file: "app/lead/[id]/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Lead details with status change, sequence assignment modals."

  - task: "Conversation Screen"
    implemented: true
    working: "NA"
    file: "app/lead/[id]/conversation.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Message thread with AI rewrite buttons and manual send."

  - task: "Sequences Tab"
    implemented: true
    working: "NA"
    file: "app/(tabs)/sequences.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "List of sequences with built-in badge."

  - task: "Settings Tab"
    implemented: true
    working: "NA"
    file: "app/(tabs)/settings.tsx"
    stuck_count: 0
    priority: "low"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Account info, business info, logout."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks:
    - "Twilio Webhook (Inbound SMS)"
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Core MVP backend implemented with PostgreSQL database. All CRUD operations tested via curl. The SMS/Email sending is MOCKED (no real Twilio/SendGrid keys yet). Frontend screens are built with React Native/Expo. Please test the backend APIs first to verify the core flow: signup -> create business -> create lead -> assign sequence -> verify follow-up scheduling."
  - agent: "testing"
    message: "Backend testing completed. CRITICAL ISSUE FOUND: Twilio webhook phone number matching is broken due to phone number normalization mismatch. All other backend APIs are working correctly including auth, business management, lead CRUD, sequence management, background worker, AI rewrite, and dashboard. The webhook bug prevents inbound SMS from stopping automation - needs immediate fix."