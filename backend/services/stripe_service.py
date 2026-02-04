import os
from typing import Optional, Tuple
import stripe
from dotenv import load_dotenv

load_dotenv()

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Initialize Stripe
if STRIPE_SECRET_KEY and not STRIPE_SECRET_KEY.startswith("sk_test_your"):
    stripe.api_key = STRIPE_SECRET_KEY
    STRIPE_ENABLED = True
else:
    STRIPE_ENABLED = False

# Plan configuration
PLAN_CONFIG = {
    "SOLO": {
        "price": 1900,  # $19.00 in cents
        "lead_limit": 50,
        "name": "Solo Plan",
        "description": "Up to 50 active leads, 1 user"
    },
    "GROWTH": {
        "price": 3900,  # $39.00
        "lead_limit": 200,
        "name": "Growth Plan",
        "description": "Up to 200 active leads, 1 user"
    },
    "TEAM": {
        "price": 7900,  # $79.00
        "lead_limit": 1000,
        "name": "Team Plan",
        "description": "Up to 1000 active leads, up to 5 users"
    }
}

async def create_checkout_session(user_email: str, plan: str, success_url: str, cancel_url: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Create a Stripe Checkout session for subscription
    Returns: (checkout_url, error)
    """
    if not STRIPE_ENABLED:
        # Mock mode
        return f"https://checkout.stripe.com/mock?plan={plan}", None
    
    try:
        plan_config = PLAN_CONFIG.get(plan)
        if not plan_config:
            return None, "Invalid plan"
        
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': plan_config['name'],
                        'description': plan_config['description'],
                    },
                    'unit_amount': plan_config['price'],
                    'recurring': {
                        'interval': 'month',
                    },
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url=success_url,
            cancel_url=cancel_url,
            customer_email=user_email,
            metadata={
                'plan': plan
            }
        )
        return session.url, None
    except Exception as e:
        return None, str(e)

async def create_customer_portal_session(customer_id: str, return_url: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Create a Stripe Customer Portal session
    Returns: (portal_url, error)
    """
    if not STRIPE_ENABLED:
        return f"https://billing.stripe.com/mock/portal", None
    
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url
        )
        return session.url, None
    except Exception as e:
        return None, str(e)

def verify_webhook_signature(payload: bytes, signature: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Verify Stripe webhook signature and return event
    Returns: (event, error)
    """
    if not STRIPE_ENABLED or not STRIPE_WEBHOOK_SECRET:
        return None, "Stripe not configured"
    
    try:
        event = stripe.Webhook.construct_event(
            payload, signature, STRIPE_WEBHOOK_SECRET
        )
        return event, None
    except stripe.error.SignatureVerificationError as e:
        return None, str(e)
    except Exception as e:
        return None, str(e)
