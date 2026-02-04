#!/usr/bin/env python3
"""
Test phone number normalization issue
"""

# Simulate the issue
stored_phone = "555-777-6666"  # How phone is stored in database
incoming_phone = "+15557776666"  # From Twilio webhook
normalized_incoming = incoming_phone[-10:]  # Last 10 digits: "5557776666"

print(f"Stored phone: {stored_phone}")
print(f"Incoming phone: {incoming_phone}")
print(f"Normalized incoming (last 10): {normalized_incoming}")
print(f"Does stored contain normalized? {normalized_incoming in stored_phone}")

# This will be False because "5557776666" is not in "555-777-6666"
# The webhook logic is flawed - it should normalize both sides or store normalized phones