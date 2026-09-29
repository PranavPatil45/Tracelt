"""
CLI utility to grant or inspect administrator privileges for Tracelt accounts.
Usage:
    python grant_admin.py [email] [--role admin]
"""

import sys
from app.database import SessionLocal
from app.models.user import User

def main():
    db = SessionLocal()
    try:
        if len(sys.argv) < 2:
            print("Current Administrators in Tracelt:")
            admins = db.query(User).filter(User.role.in_(["admin", "superadmin"])).all()
            if not admins:
                print("  (No administrators found)")
            for a in admins:
                print(f"  - [{a.role.upper()}] #{a.id} {a.full_name} <{a.email}> (Campus: {a.campus})")
            print("\nTo grant admin privileges to an account, run:")
            print("  python grant_admin.py <email>")
            return

        target_email = sys.argv[1].lower().strip()
        role = sys.argv[2] if len(sys.argv) > 2 else "admin"

        user = db.query(User).filter(User.email == target_email).first()
        if not user:
            print(f"Error: User with email '{target_email}' was not found in the database.")
            return

        old_role = user.role
        user.role = role
        db.commit()
        print(f"Success: User '{user.full_name}' <{user.email}> role updated from '{old_role}' to '{role}'.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
