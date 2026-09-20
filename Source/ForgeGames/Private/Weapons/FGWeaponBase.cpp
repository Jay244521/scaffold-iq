#include "Weapons/FGWeaponBase.h"
#include "Weapons/FGInventoryComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Net/UnrealNetwork.h"
#include "GameFramework/Pawn.h"
#include "Kismet/GameplayStatics.h"

AFGWeaponBase::AFGWeaponBase()
{
	bReplicates = true;
	PrimaryActorTick.bCanEverTick = false;

	WeaponMesh = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("WeaponMesh"));
	SetRootComponent(WeaponMesh);
}

void AFGWeaponBase::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(AFGWeaponBase, CurrentAmmo);
}

void AFGWeaponBase::OnEquipped(APawn* NewOwnerPawn, UFGInventoryComponent* OwningInventory)
{
	OwnerPawn = NewOwnerPawn;
	OwningInventoryComponent = OwningInventory;
	SetOwner(NewOwnerPawn);

	if (NewOwnerPawn)
	{
		if (USkeletalMeshComponent* PawnMesh = NewOwnerPawn->FindComponentByClass<USkeletalMeshComponent>())
		{
			AttachToComponent(PawnMesh, FAttachmentTransformRules::SnapToTargetNotIncludingScale, AttachSocketName);
		}
	}

	SetActorHiddenInGame(false);
}

void AFGWeaponBase::OnUnequipped()
{
	StopFire();
	SetActorHiddenInGame(true);
	DetachFromActor(FDetachmentTransformRules::KeepRelativeTransform);
}

void AFGWeaponBase::StartFire()
{
	if (bWantsToFire)
	{
		return;
	}

	bWantsToFire = true;
	HandleFireTick();
	GetWorldTimerManager().SetTimer(FireRateTimerHandle, this, &AFGWeaponBase::HandleFireTick, FireRate, true);
}

void AFGWeaponBase::StopFire()
{
	bWantsToFire = false;
	GetWorldTimerManager().ClearTimer(FireRateTimerHandle);
}

void AFGWeaponBase::HandleFireTick()
{
	if (!bWantsToFire || CurrentAmmo <= 0)
	{
		return;
	}

	FVector TraceStart, TraceEnd;
	if (!GetOwnerAimTrace(TraceStart, TraceEnd))
	{
		return;
	}

	if (OwnerPawn && OwnerPawn->IsLocallyControlled())
	{
		--CurrentAmmo;
		Server_Fire(TraceStart, TraceEnd);
	}
}

bool AFGWeaponBase::GetOwnerAimTrace(FVector& OutStart, FVector& OutEnd) const
{
	if (!OwnerPawn)
	{
		return false;
	}

	const AController* OwnerController = OwnerPawn->GetController();
	if (!OwnerController)
	{
		return false;
	}

	FVector ViewLocation;
	FRotator ViewRotation;
	OwnerController->GetPlayerViewPoint(ViewLocation, ViewRotation);

	OutStart = ViewLocation;
	OutEnd = ViewLocation + (ViewRotation.Vector() * Range);
	return true;
}

void AFGWeaponBase::Server_Fire_Implementation(const FVector_NetQuantize10& TraceStart, const FVector_NetQuantize10& TraceEnd)
{
	if (CurrentAmmo <= 0)
	{
		return;
	}

	--CurrentAmmo;

	FHitResult HitResult;
	FCollisionQueryParams QueryParams;
	QueryParams.AddIgnoredActor(this);
	if (OwnerPawn)
	{
		QueryParams.AddIgnoredActor(OwnerPawn);
	}

	if (GetWorld()->LineTraceSingleByChannel(HitResult, TraceStart, TraceEnd, ECC_Pawn, QueryParams))
	{
		AController* InstigatorController = OwnerPawn ? OwnerPawn->GetController() : nullptr;
		UGameplayStatics::ApplyPointDamage(HitResult.GetActor(), Damage, (TraceEnd - TraceStart).GetSafeNormal(), HitResult, InstigatorController, this, nullptr);
	}
}

void AFGWeaponBase::OnRep_CurrentAmmo()
{
}
