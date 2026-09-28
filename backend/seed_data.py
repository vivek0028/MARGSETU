import json
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.database import engine, SessionLocal, Base
from app.models.models import (
    User,
    Department,
    Corridor,
    Asset,
    AssetDefect,
    MaintenanceTask,
    BlockWindow,
    TrainMovement,
    TimetableEntry,
    Resource,
    Conflict,
    SchedulePlan,
    ScheduleAssignment,
    ExecutionRecord,
    Notification,
    AuditLog,
    DataSource,
    SystemSetting
)
from app.services.auth_service import hash_password
from app.services.priority_engine import calculate_priority_score, DEFAULT_PRIORITY_WEIGHTS

def seed_database(force: bool = False):
    """
    Seeds PostgreSQL with realistic, production-style Indian Railways synthetic dataset:
    - 6 Departments
    - 10+ Authenticated Users across all RBAC roles (Password: RailOpti@2026)
    - 4 Corridors
    - 55+ Physical Assets with Condition Scores & Defects
    - 105+ Maintenance Requests with AI-Assisted Priority Scores
    - 32 Block Windows across day/night corridors
    - 52 Passenger & Freight Train Schedules
    - 110+ Station Timetable Entries
    - 22 Specialized Maintenance Machinery & Gang Resources
    - Execution tracking records for Plan-vs-Actual
    - Persistent Notifications & Immutable Audit Logs
    """
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        user_count = db.query(User).count()
        if user_count > 0 and not force:
            print(f"[SEED] Database already populated with {user_count} users. Skipping seed.")
            return

        print("[SEED] Initializing complete production-grade database seed...")

        # ---------------------------------------------------------------------
        # 1. System Settings & Priority Weights
        # ---------------------------------------------------------------------
        setting = SystemSetting(
            key="priority_weights",
            category="priority_weights",
            value=DEFAULT_PRIORITY_WEIGHTS,
            description="Default weights for AI-assisted rule-based priority scoring engine."
        )
        db.merge(setting)

        # ---------------------------------------------------------------------
        # 2. Departments
        # ---------------------------------------------------------------------
        departments_data = [
            {"id": "ENG", "code": "ENG", "name": "Engineering (Permanent Way)", "head_name": "Sr. Divisional Engineer (Co-ord)", "contact_email": "srden@railoptiblock.local", "description": "Responsible for track alignment, rails, sleepers, ballast, turnouts, and civil infrastructure."},
            {"id": "TRD", "code": "TRD", "name": "Traction Distribution (TRD / Electrical)", "head_name": "Sr. Divisional Electrical Engineer (TRD)", "contact_email": "srdeetrd@railoptiblock.local", "description": "Overhead Equipment (OHE), 25kV traction substations, section insulators, and pantograph interfaces."},
            {"id": "SNT", "code": "SNT", "name": "Signal & Telecommunication (S&T)", "head_name": "Sr. Divisional Signal & Telecom Engineer", "contact_email": "srdste@railoptiblock.local", "description": "Electronic interlocking, point machines, track circuits, axle counters, and optic fiber networks."},
            {"id": "OPS", "code": "OPS", "name": "Operating / Traffic Operations", "head_name": "Sr. Divisional Operations Manager (DOM)", "contact_email": "srdom@railoptiblock.local", "description": "Train path scheduling, line capacity regulation, corridor possessions, and traffic block clearances."},
            {"id": "CTRL", "code": "CTRL", "name": "Divisional Control Office", "head_name": "Chief Controller (Co-ord)", "contact_email": "control@railoptiblock.local", "description": "Real-time train dispatching, Section Controller coordination, and emergency corridor regulation."},
            {"id": "ADM", "code": "ADM", "name": "Divisional Administration", "head_name": "Divisional Railway Manager (DRM)", "contact_email": "drm@railoptiblock.local", "description": "Executive divisional authority, cross-departmental arbitration, and compliance auditing."}
        ]
        for dept in departments_data:
            db.merge(Department(**dept))
        print(f"[SEED] Seeded {len(departments_data)} departments.")

        # ---------------------------------------------------------------------
        # 3. Users with Demo Accounts
        # Default password for all demo accounts: RailOpti@2026
        # ---------------------------------------------------------------------
        demo_pwd_hash = hash_password("RailOpti@2026")
        users_data = [
            {"id": "USR-ADM-001", "name": "Vivek Arya", "email": "admin@railoptiblock.local", "employee_id": "IR-ADM-1001", "department": "Administration", "designation": "Divisional System Administrator", "role": "ADMIN"},
            {"id": "USR-PLN-001", "name": "Rajesh Sharma", "email": "planner@railoptiblock.local", "employee_id": "IR-PLN-2001", "department": "Operations", "designation": "Senior Operations Block Planner", "role": "PLANNER"},
            {"id": "USR-CTRL-001", "name": "Anil Verma", "email": "control@railoptiblock.local", "employee_id": "IR-CTRL-3001", "department": "Control", "designation": "Chief Section Controller", "role": "CONTROL_OFFICER"},
            {"id": "USR-ENG-001", "name": "Vikram Singh", "email": "engineering@railoptiblock.local", "employee_id": "IR-ENG-4001", "department": "Engineering", "designation": "Assistant Divisional Engineer (P-Way)", "role": "ENGINEERING"},
            {"id": "USR-TRD-001", "name": "Suresh Nair", "email": "trd@railoptiblock.local", "employee_id": "IR-TRD-5001", "department": "TRD", "designation": "Divisional Electrical Engineer (OHE)", "role": "TRD"},
            {"id": "USR-SNT-001", "name": "Pooja Gupta", "email": "snt@railoptiblock.local", "employee_id": "IR-SNT-6001", "department": "Signal & Telecom", "designation": "Senior Section Engineer (Signals)", "role": "SIGNAL_TELECOM"},
            {"id": "USR-OPS-001", "name": "Manoj Kumar", "email": "operations@railoptiblock.local", "employee_id": "IR-OPS-7001", "department": "Operations", "designation": "Station Master / Traffic Inspector", "role": "OPERATIONS"},
            {"id": "USR-ENG-002", "name": "Sunil Yadav", "email": "inspector@railoptiblock.local", "employee_id": "IR-ENG-4002", "department": "Engineering", "designation": "Permanent Way Inspector (PWI)", "role": "ENGINEERING"},
            {"id": "USR-TRD-002", "name": "Amit Deshmukh", "email": "powercontroller@railoptiblock.local", "employee_id": "IR-TRD-5002", "department": "TRD", "designation": "Traction Power Controller (TPC)", "role": "TRD"},
            {"id": "USR-SNT-002", "name": "Deepak Joshi", "email": "signalengineer@railoptiblock.local", "employee_id": "IR-SNT-6002", "department": "Signal & Telecom", "designation": "Telecommunications Maintenance Supervisor", "role": "SIGNAL_TELECOM"}
        ]
        for u in users_data:
            user_obj = User(
                id=u["id"],
                name=u["name"],
                email=u["email"],
                employee_id=u["employee_id"],
                department=u["department"],
                designation=u["designation"],
                role=u["role"],
                hashed_password=demo_pwd_hash,
                is_active=True
            )
            db.merge(user_obj)
        print(f"[SEED] Seeded {len(users_data)} authenticated demo users.")

        # ---------------------------------------------------------------------
        # 4. Corridors
        # ---------------------------------------------------------------------
        corridors_data = [
            {"id": "CORR-01", "code": "NDLS-CNB", "name": "Mainline Corridor Alpha (New Delhi – Kanpur Central)", "division": "Delhi Division", "zone": "Northern Railway", "total_km": 440.0, "sections": ["Section A-B", "Section B-C", "Section C-D", "Section D-E"]},
            {"id": "CORR-02", "code": "NDLS-GZB", "name": "Corridor Beta (New Delhi – Ghaziabad Suburban)", "division": "Delhi Division", "zone": "Northern Railway", "total_km": 28.5, "sections": ["Section A-B"]},
            {"id": "CORR-03", "code": "GZB-ALJN", "name": "Corridor Gamma (Ghaziabad – Aligarh Junction)", "division": "Prayagraj Division", "zone": "North Central Railway", "total_km": 106.0, "sections": ["Section B-C"]},
            {"id": "CORR-04", "code": "ALJN-CNB", "name": "Corridor Delta (Aligarh Junction – Kanpur Central)", "division": "Prayagraj Division", "zone": "North Central Railway", "total_km": 305.5, "sections": ["Section C-D", "Section D-E"]}
        ]
        for c in corridors_data:
            db.merge(Corridor(**c))
        print(f"[SEED] Seeded {len(corridors_data)} corridors.")

        # ---------------------------------------------------------------------
        # 5. Assets (56 Physical Infrastructure Assets)
        # ---------------------------------------------------------------------
        sections = [
            "Section A-B", "Section B-C", "Section C-D", "Section D-E",
            "Section E-F", "Section F-G", "Section G-H"
        ]
        asset_types = [
            ("Track", "Engineering", "60kg UIC Continuous Welded Rail (CWR)", "Operational", 82.0),
            ("Signal", "Signal & Telecom", "Multi-Aspect Colour Light Signal (MACLS)", "Operational", 89.0),
            ("Point Machine", "Signal & Telecom", "IRS Electric Point Machine Type 143", "Degraded", 64.0),
            ("Telecom", "Signal & Telecom", "Underground 24-Fiber Armoured OFC Cable", "Operational", 94.0),
            ("OHE", "TRD", "25kV AC Regulated Contact & Catenary Wire", "Operational", 78.0),
            ("Traction Substation", "TRD", "132/25kV 30MVA Traction Transformer Substation", "Operational", 88.0),
            ("Bridge", "Engineering", "Steel Girder Open-Web Span Bridge #42", "Operational", 85.0),
            ("Track Circuit", "Signal & Telecom", "Digital High-Frequency Track Circuit (DAC)", "Operational", 91.0)
        ]

        assets_created = []
        asset_idx = 1
        for sec in sections:
            for at_name, at_dept, at_desc, at_status, at_cond in asset_types:
                a_id = f"AST-{at_name[:3].upper()}-{asset_idx:03d}"
                a_code = f"IR-{sec.replace(' ', '')}-{at_name[:3].upper()}-{asset_idx:02d}"
                km_start = 100 + (asset_idx * 4)
                km_str = f"KM {km_start}.0 - {km_start + 3}.5"
                cond = max(52.0, min(98.0, at_cond + ((asset_idx % 7) - 3) * 2.5))
                crit = "Critical" if cond < 70.0 else ("High" if cond < 80.0 else "Medium")
                status_val = "Degraded" if cond < 68.0 else "Operational"

                asset = Asset(
                    id=a_id,
                    asset_code=a_code,
                    asset_name=f"{at_name} Asset #{asset_idx:02d} ({sec})",
                    asset_type=at_name,
                    department=at_dept,
                    corridor="Mainline Corridor Alpha",
                    location=sec,
                    kilometer=km_str,
                    status=status_val,
                    criticality=crit,
                    installation_date="2018-04-15",
                    last_maintenance="2026-08-10",
                    next_maintenance="2026-10-05",
                    condition_score=round(cond, 1),
                    defect_count=2 if cond < 70 else (1 if cond < 85 else 0),
                    owner_department=at_dept
                )
                db.merge(asset)
                assets_created.append(asset)
                asset_idx += 1

        print(f"[SEED] Seeded {len(assets_created)} Physical Assets.")

        # ---------------------------------------------------------------------
        # 6. Asset Defects
        # ---------------------------------------------------------------------
        sample_defects = [
            ("AST-TRA-001", "Rail Flaw / Ultrasonic Flaw Detection (USFD)", "Critical", "Transverse fissure detected in left rail at weld joint KM 104.2."),
            ("AST-OHE-005", "Dropper Wear / Contact Wire Groove Thinning", "High", "OHE contact wire wear exceeding 20% limit near bridge portal."),
            ("AST-POI-003", "Stretcher Bar Clearance Misalignment", "Critical", "Obstruction test failed with 5mm gauge strip on Facing Point #102."),
            ("AST-SIG-002", "Aspect Lamp Voltage Fluctuation", "Medium", "Current fluctuation recorded on Green aspect relay circuit."),
            ("AST-BRI-007", "Rocker Bearing Corrosion", "High", "Pier 3 bearing plate showing early corrosion; tamping pack loosening."),
            ("AST-TRA-009", "Ballast Cushion Fouling & Caking", "Medium", "Ballast shoulder choked with silt, causing poor drainage during rains."),
            ("AST-OHE-013", "Section Insulator Sagging", "Critical", "Excessive contact wire sag observed under pantograph passage at 110 kmph."),
            ("AST-TEL-012", "OFC Optical Decibel Loss", "Medium", "Fiber attenuation jumped from 0.22 dB/km to 0.48 dB/km near culvert #19.")
        ]
        for ast_id, d_type, d_sev, d_desc in sample_defects:
            defect = AssetDefect(
                id=f"DEF-{uuid.uuid4().hex[:8].upper()}",
                asset_id=ast_id,
                defect_type=d_type,
                severity=d_sev,
                description=d_desc,
                reported_by="Divisional Quality Inspector",
                status="Open",
                reported_at=datetime.utcnow() - timedelta(days=2)
            )
            db.merge(defect)

        # ---------------------------------------------------------------------
        # 7. Block Windows (32 Slots across 7 Days)
        # ---------------------------------------------------------------------
        base_date = datetime.strptime("2026-09-24", "%Y-%m-%d")
        block_slots = [
            ("01:30:00", "05:00:00", 3.5, "Absolute Night Traffic Block", ["Engineering", "S&T", "TRD", "Operations"]),
            ("09:00:00", "12:00:00", 3.0, "Routine Day Shadow Block", ["Engineering", "S&T"]),
            ("13:30:00", "16:00:00", 2.5, "Mid-Day Rolling Stock & OHE Window", ["TRD", "Engineering"]),
            ("23:30:00", "03:30:00", 4.0, "Corridor Power & Traffic Block", ["TRD", "Engineering", "S&T"])
        ]
        
        blocks_created = []
        b_idx = 101
        for day_offset in range(8):
            dt_str = (base_date + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            for sec in ["Section A-B", "Section B-C", "Section C-D", "Section D-E"]:
                slot = block_slots[(b_idx) % len(block_slots)]
                b_id = f"BLK-{b_idx}"
                block = BlockWindow(
                    block_id=b_id,
                    corridor="Mainline Corridor Alpha",
                    corridor_name="Mainline Corridor Alpha",
                    section=sec,
                    direction="UP" if b_idx % 2 == 0 else "DOWN",
                    date=dt_str,
                    start_time=slot[0],
                    end_time=slot[1],
                    max_duration_hours=slot[2],
                    block_type=slot[3],
                    allowed_departments=slot[4],
                    status="Available" if b_idx % 3 != 0 else "Allocated",
                    reason="Scheduled divisional maintenance possession window.",
                    data_label="DEMO DATA"
                )
                db.merge(block)
                blocks_created.append(block)
                b_idx += 1
                if len(blocks_created) >= 32:
                    break
            if len(blocks_created) >= 32:
                break

        print(f"[SEED] Seeded {len(blocks_created)} Block Windows.")

        # ---------------------------------------------------------------------
        # 8. Train Movements (52 Schedules) & Timetable Entries
        # ---------------------------------------------------------------------
        train_templates = [
            ("12002", "Bhopal Shatabdi Express", "Premium Express", "UP", 1, 130.0, "06:00:00", "08:15:00"),
            ("22436", "Vande Bharat Express (NDLS-BSB)", "Vande Bharat", "DOWN", 1, 130.0, "06:00:00", "08:30:00"),
            ("12302", "Howrah Rajdhani Express", "Premium Express", "DOWN", 1, 130.0, "16:55:00", "19:40:00"),
            ("12424", "Dibrugarh Rajdhani Express", "Premium Express", "DOWN", 1, 130.0, "16:10:00", "18:45:00"),
            ("12952", "Mumbai Tejas Rajdhani", "Premium Express", "UP", 1, 130.0, "16:55:00", "19:15:00"),
            ("12417", "Prayagraj Express", "Superfast", "DOWN", 2, 110.0, "22:10:00", "01:20:00"),
            ("12554", "Vaishali Superfast Express", "Superfast", "DOWN", 2, 110.0, "20:40:00", "23:50:00"),
            ("12398", "Mahabodhi Superfast Express", "Superfast", "DOWN", 2, 110.0, "12:50:00", "15:40:00"),
            ("12401", "Magadh Superfast Express", "Superfast", "DOWN", 2, 110.0, "20:00:00", "23:10:00"),
            ("14218", "Unchahar Express", "Passenger", "DOWN", 3, 85.0, "21:30:00", "01:45:00"),
            ("BOXN-902", "Container Freight Unit (CONCOR-Alpha)", "Freight", "UP", 4, 75.0, "02:00:00", "04:30:00"),
            ("BCN-804", "Foodgrains Special Rake (FCI-Northern)", "Freight", "DOWN", 4, 75.0, "03:15:00", "05:45:00"),
            ("BOBRN-104", "Coal Rake (Thermal Power Plant)", "Freight", "UP", 4, 70.0, "13:00:00", "15:30:00")
        ]

        train_count = 0
        tt_count = 0
        for day_offset in range(4):
            day_date = (base_date + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            for t_no, t_name, t_type, t_dir, t_rank, t_speed, s_dep, s_arr in train_templates:
                unique_train_no = f"{t_no}-{day_date[-2:]}" if day_offset > 0 else t_no
                dep_dt_iso = f"{day_date}T{s_dep}Z"
                arr_dt_iso = f"{day_date}T{s_arr}Z"
                sec_assigned = sections[train_count % len(sections)]

                train_obj = TrainMovement(
                    train_no=unique_train_no,
                    train_name=t_name,
                    train_type=t_type,
                    origin="New Delhi (NDLS)",
                    destination="Kanpur Central (CNB)",
                    corridor="Mainline Corridor Alpha",
                    section=sec_assigned,
                    direction=t_dir,
                    scheduled_departure=dep_dt_iso,
                    scheduled_arrival=arr_dt_iso,
                    priority_rank=t_rank,
                    speed_kmph=t_speed,
                    frequency="Daily",
                    data_label="DEMO DATA"
                )
                db.merge(train_obj)
                train_count += 1

                # Generate 2 timetable halt entries per train
                tt1 = TimetableEntry(
                    id=f"TT-{unique_train_no}-01",
                    train_no=unique_train_no,
                    station_code="NDLS" if t_dir == "DOWN" else "GZB",
                    station_name="New Delhi" if t_dir == "DOWN" else "Ghaziabad",
                    arrival_time=s_dep[:5],
                    departure_time=s_dep[:5],
                    platform="2",
                    halt_minutes=5,
                    day_number=1
                )
                tt2 = TimetableEntry(
                    id=f"TT-{unique_train_no}-02",
                    train_no=unique_train_no,
                    station_code="ALJN" if t_dir == "DOWN" else "NDLS",
                    station_name="Aligarh Junction" if t_dir == "DOWN" else "New Delhi",
                    arrival_time=s_arr[:5],
                    departure_time=s_arr[:5],
                    platform="4",
                    halt_minutes=3,
                    day_number=1
                )
                db.merge(tt1)
                db.merge(tt2)
                tt_count += 2
                if train_count >= 52:
                    break
            if train_count >= 52:
                break

        print(f"[SEED] Seeded {train_count} Trains and {tt_count} Timetable Entries.")

        # ---------------------------------------------------------------------
        # 9. Maintenance Resources (22 Machinery & Gang Units)
        # ---------------------------------------------------------------------
        resources_data = [
            {"resource_id": "RES-CSM-01", "name": "Continuous Action Tamping Machine (09-3X CSM)", "resource_type": "Heavy Machinery", "department": "Engineering", "home_depot": "Ghaziabad P-Way Depot", "available": True},
            {"resource_id": "RES-CSM-02", "name": "Plasser Track Tamper CSM-02", "resource_type": "Heavy Machinery", "department": "Engineering", "home_depot": "Aligarh P-Way Yard", "available": True},
            {"resource_id": "RES-BCM-01", "name": "Ballast Cleaning Machine (BCM-350)", "resource_type": "Heavy Machinery", "department": "Engineering", "home_depot": "Tundla Yard", "available": True},
            {"resource_id": "RES-DGS-01", "name": "Dynamic Track Stabilizer (DGS-62N)", "resource_type": "Heavy Machinery", "department": "Engineering", "home_depot": "Ghaziabad Depot", "available": True},
            {"resource_id": "RES-ENG-GANG-01", "name": "P-Way Section Gang #1 (12 Trackmen)", "resource_type": "Gang/Crew", "department": "Engineering", "home_depot": "Delhi Central Depot", "available": True},
            {"resource_id": "RES-ENG-GANG-02", "name": "P-Way Section Gang #2 (15 Trackmen)", "resource_type": "Gang/Crew", "department": "Engineering", "home_depot": "Khurja Junction Yard", "available": True},
            {"resource_id": "RES-ENG-GANG-03", "name": "Turnout Overhaul Gang #3", "resource_type": "Gang/Crew", "department": "Engineering", "home_depot": "Aligarh Yard", "available": False},
            {"resource_id": "RES-USFD-01", "name": "Digital USFD Flaw Detection Unit", "resource_type": "Inspection Vehicle", "department": "Engineering", "home_depot": "Ghaziabad Testing Lab", "available": True},
            {"resource_id": "RES-TWR-WGN-01", "name": "OHE 8-Wheeler Self-Propelled Tower Wagon #104", "resource_type": "Tower Wagon", "department": "TRD", "home_depot": "Ghaziabad TRD Depot", "available": True},
            {"resource_id": "RES-TWR-WGN-02", "name": "OHE 4-Wheeler Inspection Tower Car #202", "resource_type": "Tower Wagon", "department": "TRD", "home_depot": "Aligarh TRD Depot", "available": True},
            {"resource_id": "RES-TRD-CREW-01", "name": "TRD OHE Overhead Maintenance Squad #1", "resource_type": "Gang/Crew", "department": "TRD", "home_depot": "Ghaziabad Substation", "available": True},
            {"resource_id": "RES-TRD-CREW-02", "name": "TRD Substation Electrical Gang #2", "resource_type": "Gang/Crew", "department": "TRD", "home_depot": "Khurja TRD Depot", "available": True},
            {"resource_id": "RES-TRD-WIR-01", "name": "High-Speed Wiring Train Rake (TRD-WT)", "resource_type": "Heavy Machinery", "department": "TRD", "home_depot": "Tundla Electric Shed", "available": True},
            {"resource_id": "RES-SNT-TEAM-01", "name": "Signal Electronic Interlocking Maintenance Team #1", "resource_type": "Gang/Crew", "department": "Signal & Telecom", "home_depot": "Delhi Signal Control", "available": True},
            {"resource_id": "RES-SNT-TEAM-02", "name": "Point Machine Overhauling Squad #2", "resource_type": "Gang/Crew", "department": "Signal & Telecom", "home_depot": "Ghaziabad S&T Lab", "available": True},
            {"resource_id": "RES-SNT-TEAM-03", "name": "Axle Counter Calibration Gang #3", "resource_type": "Gang/Crew", "department": "Signal & Telecom", "home_depot": "Aligarh S&T Depot", "available": True},
            {"resource_id": "RES-TEL-OFC-01", "name": "Optic Fiber Splicing & OTDR Emergency Van", "resource_type": "Inspection Vehicle", "department": "Signal & Telecom", "home_depot": "Ghaziabad Telecom", "available": True},
            {"resource_id": "RES-CRANE-01", "name": "140-Tonne Railway Breakdown Relief Crane", "resource_type": "Heavy Machinery", "department": "Engineering", "home_depot": "Tundla Accident Relief", "available": True},
            {"resource_id": "RES-RAIL-TRUCK-01", "name": "Dip-Lorry Rail Welding Squad #1", "resource_type": "Gang/Crew", "department": "Engineering", "home_depot": "Delhi Central Depot", "available": True},
            {"resource_id": "RES-GENSET-01", "name": "Emergency Diesel Mobile Floodlight Genset (60kVA)", "resource_type": "Heavy Machinery", "department": "Operations", "home_depot": "Ghaziabad Yard", "available": True},
            {"resource_id": "RES-SNT-VAN-01", "name": "Signal Testing & Relay Test Van", "resource_type": "Inspection Vehicle", "department": "Signal & Telecom", "home_depot": "Delhi Central Depot", "available": True},
            {"resource_id": "RES-TRD-VAN-01", "name": "Thermal Imaging & Hot-Spot Inspection Car", "resource_type": "Inspection Vehicle", "department": "TRD", "home_depot": "Ghaziabad TRD", "available": True}
        ]
        for res in resources_data:
            db.merge(Resource(**res))
        print(f"[SEED] Seeded {len(resources_data)} Machinery & Crew Resources.")

        # ---------------------------------------------------------------------
        # 10. Maintenance Requests (105+ Work Orders with Dynamic AI Priority Scoring)
        # ---------------------------------------------------------------------
        task_templates = [
            ("Track Tamping & Lining", "Engineering", "Track", 2.5, "Routine tamping and ballast compaction to restore track geometry.", "Critical", "Immediate", "Critical", "Severe", True, ["Continuous Action Tamping Machine (09-3X CSM)", "P-Way Section Gang #1 (12 Trackmen)"], ["TRD", "Signal & Telecom"]),
            ("OHE Contact Wire Replacement", "TRD", "OHE", 3.0, "Replace worn 107 sq mm copper contact wire over 1.2 km section.", "Critical", "High", "Critical", "High", True, ["OHE 8-Wheeler Self-Propelled Tower Wagon #104", "TRD OHE Overhead Maintenance Squad #1"], ["Engineering"]),
            ("Point Machine 143 Overhaul", "Signal & Telecom", "Point Machine", 2.0, "Quarterly overhaul of electrical switch point machine and facing point lock.", "High", "High", "Severe", "High", False, ["Point Machine Overhauling Squad #2"], ["Engineering"]),
            ("USFD Rail Flaw Rectification", "Engineering", "Track", 2.0, "Cut and replace rail piece with transverse defect identified by USFD.", "Critical", "Immediate", "Critical", "Severe", True, ["P-Way Section Gang #1 (12 Trackmen)", "Digital USFD Flaw Detection Unit"], ["TRD"]),
            ("Digital Axle Counter Calibration", "Signal & Telecom", "Signal", 1.5, "Reset and fine-tune track electronic axle counter sensors at crossover.", "Medium", "Normal", "Moderate", "Medium", False, ["Axle Counter Calibration Gang #3"], []),
            ("Ballast Shoulder Cleaning (BCM)", "Engineering", "Track", 3.5, "Deep screening of track ballast cushion to prevent track waterlogging.", "High", "Normal", "Moderate", "High", False, ["Ballast Cleaning Machine (BCM-350)", "P-Way Section Gang #2 (15 Trackmen)"], ["TRD"]),
            ("OHE Cantilever Insulator Washing", "TRD", "OHE", 2.0, "Jet-spray cleaning of 25kV composite insulators to stop flashovers.", "High", "High", "Severe", "Medium", False, ["OHE 4-Wheeler Inspection Tower Car #202"], ["Engineering"]),
            ("Underground OFC Cable Splicing", "Signal & Telecom", "Telecom", 2.5, "Permanent jointing and joint-box sealing of 24-fiber telecommunication link.", "Medium", "Normal", "Minor", "Low", False, ["Optic Fiber Splicing & OTDR Emergency Van"], []),
            ("Turnout Sleepers Replacement", "Engineering", "Track", 3.0, "Replace damaged PSC turn-out sleepers at 1-in-12 curved crossover.", "High", "High", "Severe", "High", False, ["Turnout Overhaul Gang #3"], ["Signal & Telecom"]),
            ("Traction Substation Breaker Servicing", "TRD", "Traction Substation", 2.5, "Preventive maintenance on 25kV vacuum circuit breakers.", "Medium", "Normal", "Moderate", "Medium", False, ["TRD Substation Electrical Gang #2"], []),
            ("Color Light Signal Aspect Tuning", "Signal & Telecom", "Signal", 1.0, "Replacement of transformer unit and lamp alignment on Home Signal.", "Low", "Low", "Minor", "Low", False, ["Signal Electronic Interlocking Maintenance Team #1"], []),
            ("Girder Bridge Rivet Inspection", "Engineering", "Bridge", 2.5, "Inspection of cross-girders and replacement of sheared rivets on Bridge #42.", "High", "Normal", "Moderate", "Medium", False, ["P-Way Section Gang #2 (15 Trackmen)"], [])
        ]

        tasks_created = []
        task_id_counter = 1
        for day_offset in range(9):
            task_date = (base_date + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            deadline_date = (base_date + timedelta(days=day_offset + 3)).strftime("%Y-%m-%d")

            for tmpl in task_templates:
                title, dept, a_type, dur, desc, crit, urg, def_sev, op_imp, is_overdue, req_res, comp_depts = tmpl

                sec = sections[task_id_counter % len(sections)]
                t_id = f"TASK-{task_id_counter:03d}"
                
                # Match to asset if available
                matching_asset = next((a for a in assets_created if a.location == sec and a.asset_type.lower() in a_type.lower()), None)
                asset_id_val = matching_asset.id if matching_asset else None

                # Calculate AI-assisted Priority Score & factor breakdown
                score, band, factors = calculate_priority_score(
                    criticality=crit,
                    urgency=urg,
                    overdue=is_overdue,
                    defect_severity=def_sev,
                    operational_impact=op_imp
                )

                task = MaintenanceTask(
                    task_id=t_id,
                    asset_id=asset_id_val,
                    department=dept,
                    asset_type=a_type,
                    location=sec,
                    corridor="Mainline Corridor Alpha",
                    task_title=f"{title} ({sec})",
                    description=f"{desc} Target Asset: {matching_asset.asset_code if matching_asset else 'Corridor Asset'}.",
                    maintenance_type="Corrective" if crit == "Critical" else "Preventive",
                    duration_hours=dur,
                    preferred_date=task_date,
                    preferred_start="02:00:00" if "Night" in title or crit == "Critical" else "09:30:00",
                    preferred_end="04:30:00" if "Night" in title or crit == "Critical" else "12:00:00",
                    deadline=deadline_date,
                    criticality=crit,
                    urgency=urg,
                    defect_severity=def_sev,
                    operational_impact=op_imp,
                    overdue=is_overdue,
                    required_team_size=8 if crit == "Critical" else 5,
                    required_resources=req_res,
                    dependencies=[],
                    compatible_departments=comp_depts,
                    safety_requirements="Corridor possession, 25kV traction power isolation, and track circuit bypass required.",
                    notes="Approved for priority optimization slot.",
                    priority_factors=factors,
                    priority_score=score,
                    status="Pending" if task_id_counter % 4 != 0 else ("Scheduled" if task_id_counter % 2 == 0 else "Completed"),
                    assigned_block_id=f"BLK-{101 + (task_id_counter % 20)}" if task_id_counter % 4 == 0 else None,
                    created_by="Divisional Operations Manager",
                    created_by_id="USR-PLN-001",
                    data_source="BDMS",
                    data_label="DEMO DATA",
                    created_at=datetime.utcnow() - timedelta(days=2)
                )
                db.merge(task)
                tasks_created.append(task)
                task_id_counter += 1
                if len(tasks_created) >= 105:
                    break
            if len(tasks_created) >= 105:
                break

        print(f"[SEED] Seeded {len(tasks_created)} Maintenance Requests with AI-Assisted Priority Scores.")

        # ---------------------------------------------------------------------
        # 11. Operational Conflicts
        # ---------------------------------------------------------------------
        conflicts_data = [
            {
                "conflict_id": "CONF-001",
                "conflict_type": "Timetable",
                "severity": "Critical",
                "affected_tasks": ["TASK-001", "TASK-002"],
                "affected_trains": ["12002", "22436"],
                "affected_corridor": "Mainline Corridor Alpha",
                "start_time": "06:00:00",
                "end_time": "08:30:00",
                "explanation": "Preferred block window on Section A-B directly overlaps with high-priority Vande Bharat (22436) and Bhopal Shatabdi (12002) express movements.",
                "suggested_resolution": "Shift corridor block allocation to night slot 01:30–05:00 or re-route freight traffic via chord line.",
                "status": "Active"
            },
            {
                "conflict_id": "CONF-002",
                "conflict_type": "Resource",
                "severity": "Warning",
                "affected_tasks": ["TASK-001", "TASK-006"],
                "affected_trains": [],
                "affected_corridor": "Mainline Corridor Alpha",
                "start_time": "01:30:00",
                "end_time": "04:30:00",
                "explanation": "Both Track Tamping and Ballast Cleaning requisition Continuous Action Tamping Machine CSM-01 simultaneously on Section B-C.",
                "suggested_resolution": "Stagger tasks across consecutive night windows or mobilize standby Tamper CSM-02 from Aligarh depot.",
                "status": "Active"
            },
            {
                "conflict_id": "CONF-003",
                "conflict_type": "Department",
                "severity": "Attention",
                "affected_tasks": ["TASK-003"],
                "affected_trains": [],
                "affected_corridor": "Mainline Corridor Alpha",
                "start_time": "13:30:00",
                "end_time": "15:30:00",
                "explanation": "Signal department Point Machine maintenance requires simultaneous Engineering trackman support for switch-rail gauge verification.",
                "suggested_resolution": "Bundle TASK-003 with compatible Engineering P-Way maintenance block.",
                "status": "Resolved",
                "resolution_notes": "Joint bundling approved by Sr. DOM. Gang #1 co-allocated.",
                "resolved_by": "Sr. DOM (Rajesh Sharma)",
                "resolved_at": datetime.utcnow() - timedelta(hours=4)
            }
        ]
        for conf in conflicts_data:
            db.merge(Conflict(**conf))
        print(f"[SEED] Seeded {len(conflicts_data)} Operational Conflicts.")

        # ---------------------------------------------------------------------
        # 12. Execution Records (Plan vs Actual)
        # ---------------------------------------------------------------------
        execution_samples = [
            {
                "id": "EXEC-001",
                "plan_id": "PLAN-A-CRIT",
                "task_id": "TASK-004",
                "block_id": "BLK-101",
                "department": "Engineering",
                "section": "Section A-B",
                "status": "COMPLETED",
                "planned_start": "2026-09-24T01:30:00Z",
                "actual_start": "2026-09-24T01:45:00Z",
                "planned_end": "2026-09-24T04:00:00Z",
                "actual_end": "2026-09-24T04:25:00Z",
                "planned_duration_hours": 2.5,
                "actual_duration_hours": 2.67,
                "delay_minutes": 25,
                "progress_percent": 100,
                "assigned_team": "P-Way Section Gang #1",
                "resources_deployed": ["Digital USFD Flaw Detection Unit"],
                "issue_notes": "Minor delay of 15 min in obtaining traction power isolation permit from TPC.",
                "completion_notes": "Rail flaw cut and 6-meter rail piece inserted with thermit weld. Track cleared at 110 kmph."
            },
            {
                "id": "EXEC-002",
                "plan_id": "PLAN-A-CRIT",
                "task_id": "TASK-002",
                "block_id": "BLK-102",
                "department": "TRD",
                "section": "Section B-C",
                "status": "IN_PROGRESS",
                "planned_start": "2026-09-24T02:00:00Z",
                "actual_start": "2026-09-24T02:05:00Z",
                "planned_end": "2026-09-24T05:00:00Z",
                "actual_end": None,
                "planned_duration_hours": 3.0,
                "actual_duration_hours": None,
                "delay_minutes": 5,
                "progress_percent": 65,
                "assigned_team": "TRD OHE Maintenance Squad #1",
                "resources_deployed": ["OHE 8-Wheeler Tower Wagon #104"],
                "issue_notes": "Working steadily on contact wire unrolling.",
                "completion_notes": None
            },
            {
                "id": "EXEC-003",
                "plan_id": "PLAN-C-BUNDLE",
                "task_id": "TASK-003",
                "block_id": "BLK-103",
                "department": "Signal & Telecom",
                "section": "Section C-D",
                "status": "READY",
                "planned_start": "2026-09-25T01:30:00Z",
                "actual_start": None,
                "planned_end": "2026-09-25T03:30:00Z",
                "actual_end": None,
                "planned_duration_hours": 2.0,
                "actual_duration_hours": None,
                "delay_minutes": 0,
                "progress_percent": 0,
                "assigned_team": "Point Machine Overhauling Squad #2",
                "resources_deployed": ["Signal Testing & Relay Test Van"],
                "issue_notes": None,
                "completion_notes": None
            }
        ]
        for ex in execution_samples:
            db.merge(ExecutionRecord(**ex))
        print(f"[SEED] Seeded {len(execution_samples)} Execution Records.")

        # ---------------------------------------------------------------------
        # 13. Notifications
        # ---------------------------------------------------------------------
        notifications_data = [
            {"title": "High Priority Safety Requisition", "message": "Critical USFD rail defect reported on Section A-B (AST-TRA-001). Priority Score: 92.", "notification_type": "REQUEST", "link_url": "/maintenance", "recipient_role": "PLANNER"},
            {"title": "Timetable Conflict Detected", "message": "Proposed block BLK-102 collides with Vande Bharat Express path (22436).", "notification_type": "CONFLICT", "link_url": "/conflicts", "recipient_role": "CONTROL_OFFICER"},
            {"title": "CP-SAT Optimization Generated", "message": "3 candidate plans generated for Mainline Corridor Alpha. Review Plan A vs Plan C.", "notification_type": "OPTIMIZATION", "link_url": "/optimizer", "recipient_role": "PLANNER"},
            {"title": "Plan A Awaiting Formal Sanction", "message": "Plan A submitted for executive approval by Sr. DOM.", "notification_type": "APPROVAL", "link_url": "/approval", "recipient_role": "ADMIN"},
            {"title": "Maintenance Block Executing", "message": "OHE contact wire replacement in progress on Section B-C (65% completed).", "notification_type": "EXECUTION", "link_url": "/execution", "recipient_role": "OPERATIONS"}
        ]
        for notif in notifications_data:
            n_obj = Notification(
                title=notif["title"],
                message=notif["message"],
                notification_type=notif["notification_type"],
                link_url=notif["link_url"],
                recipient_role=notif["recipient_role"],
                is_read=False
            )
            db.add(n_obj)

        # ---------------------------------------------------------------------
        # 14. Append-Only Audit Trail
        # ---------------------------------------------------------------------
        audit_samples = [
            {"user_name": "Rajesh Sharma", "user_role": "PLANNER", "action": "Task Created", "target_id": "TASK-001", "target_type": "TASK", "details": "Created emergency P-Way tamping requisition for Section A-B.", "ip_address": "10.12.4.15"},
            {"user_name": "Rajesh Sharma", "user_role": "PLANNER", "action": "Optimisation Plan Generated", "target_id": "RUN-ALPHA", "target_type": "PLAN", "details": "Executed Google OR-Tools CP-SAT multi-objective solver.", "ip_address": "10.12.4.15"},
            {"user_name": "Anil Verma", "user_role": "CONTROL_OFFICER", "action": "Conflict Resolved", "target_id": "CONF-003", "target_type": "CONFLICT", "details": "Approved cross-department bundling of S&T Point machine with P-Way gang.", "ip_address": "10.12.4.22"},
            {"user_name": "Vivek Arya", "user_role": "ADMIN", "action": "Plan Approved", "target_id": "PLAN-A-CRIT", "target_type": "PLAN", "details": "Approved Plan A Maximum Critical Coverage for execution week.", "ip_address": "10.12.4.10"},
            {"user_name": "Vikram Singh", "user_role": "ENGINEERING", "action": "EXECUTION_UPDATED", "target_id": "EXEC-001", "target_type": "EXECUTION", "details": "Marked rail flaw rectification on Section A-B as COMPLETED.", "ip_address": "10.12.5.30"}
        ]
        for aud in audit_samples:
            db.add(AuditLog(
                user_name=aud["user_name"],
                user_role=aud["user_role"],
                action=aud["action"],
                target_id=aud["target_id"],
                target_type=aud["target_type"],
                details=aud["details"],
                ip_address=aud["ip_address"]
            ))

        # ---------------------------------------------------------------------
        # 15. Data Sources
        # ---------------------------------------------------------------------
        sources = [
            {"source_id": "SRC-BDMS", "name": "BDMS", "full_name": "Block Demand Management System", "system_type": "Requisition Adapter", "status": "Connected (Live Sync)", "last_sync": datetime.utcnow().strftime("%Y-%m-%d %H:%M"), "record_count": 105, "description": "Aggregates engineering, electrical, and signal block requisitions."},
            {"source_id": "SRC-TMS", "name": "TMS", "full_name": "Track Management System", "system_type": "Asset Health Adapter", "status": "Connected (Live Sync)", "last_sync": datetime.utcnow().strftime("%Y-%m-%d %H:%M"), "record_count": 55, "description": "Provides track geometry car recordings and ultrasonic rail defect inspections."},
            {"source_id": "SRC-COA", "name": "COA", "full_name": "Control Office Application", "system_type": "Timetable Adapter", "status": "Connected (Live Sync)", "last_sync": datetime.utcnow().strftime("%Y-%m-%d %H:%M"), "record_count": 52, "description": "Feeds real-time passenger train paths and Section Controller timetables."},
            {"source_id": "SRC-FOIS", "name": "FOIS", "full_name": "Freight Operations Information System", "system_type": "Freight Forecast Adapter", "status": "Connected (Live Sync)", "last_sync": datetime.utcnow().strftime("%Y-%m-%d %H:%M"), "record_count": 18, "description": "Provides freight train schedules, rake loadings, and corridor forecasts."}
        ]
        for src in sources:
            db.merge(DataSource(**src))

        db.commit()
        print("[SEED] Successfully seeded complete production database in PostgreSQL!")

    except Exception as e:
        db.rollback()
        print(f"[SEED ERROR] Failed to seed database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database(force=True)
