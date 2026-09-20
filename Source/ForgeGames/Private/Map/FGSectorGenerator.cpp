#include "Map/FGSectorGenerator.h"

AFGSectorGenerator::AFGSectorGenerator()
{
	PrimaryActorTick.bCanEverTick = false;
	bReplicates = false;
	SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));
}

void AFGSectorGenerator::GenerateMap()
{
	if (!HasAuthority())
	{
		return;
	}

	for (AActor* Spawned : SpawnedSectorActors)
	{
		if (Spawned)
		{
			Spawned->Destroy();
		}
	}
	SpawnedSectorActors.Reset();
	SectorDefinitions.Reset();

	const int32 SeedToUse = RandomSeed != 0 ? RandomSeed : FMath::Rand();
	FRandomStream Stream(SeedToUse);

	const float HalfWidth = (GridWidth - 1) * SectorSize * 0.5f;
	const float HalfHeight = (GridHeight - 1) * SectorSize * 0.5f;

	for (int32 Y = 0; Y < GridHeight; ++Y)
	{
		for (int32 X = 0; X < GridWidth; ++X)
		{
			FFGSectorDefinition SectorDefinition;
			SectorDefinition.GridCoord = FIntPoint(X, Y);
			SectorDefinition.SectorType = PickWeightedSectorType(Stream);
			SectorDefinition.WorldLocation = FVector(
				X * SectorSize - HalfWidth,
				Y * SectorSize - HalfHeight,
				0.f);

			SectorDefinitions.Add(SectorDefinition);
			SpawnSectorContent(SectorDefinition, Stream);
		}
	}
}

EFGSectorType AFGSectorGenerator::PickWeightedSectorType(FRandomStream& Stream) const
{
	float TotalWeight = 0.f;
	for (const FFGSectorTypeEntry& Entry : SectorTypeEntries)
	{
		TotalWeight += FMath::Max(0.f, Entry.SelectionWeight);
	}

	if (TotalWeight <= 0.f)
	{
		return EFGSectorType::Open;
	}

	float Roll = Stream.FRandRange(0.f, TotalWeight);
	for (const FFGSectorTypeEntry& Entry : SectorTypeEntries)
	{
		Roll -= FMath::Max(0.f, Entry.SelectionWeight);
		if (Roll <= 0.f)
		{
			return Entry.SectorType;
		}
	}

	return SectorTypeEntries.Last().SectorType;
}

void AFGSectorGenerator::SpawnSectorContent(const FFGSectorDefinition& SectorDefinition, FRandomStream& Stream)
{
	const FFGSectorTypeEntry* MatchingEntry = SectorTypeEntries.FindByPredicate([&SectorDefinition](const FFGSectorTypeEntry& Entry)
	{
		return Entry.SectorType == SectorDefinition.SectorType;
	});

	if (!MatchingEntry || MatchingEntry->SectorTemplates.Num() == 0)
	{
		return;
	}

	const int32 TemplateIndex = Stream.RandRange(0, MatchingEntry->SectorTemplates.Num() - 1);
	TSubclassOf<AActor> TemplateClass = MatchingEntry->SectorTemplates[TemplateIndex];
	if (!TemplateClass)
	{
		return;
	}

	FActorSpawnParameters SpawnParams;
	SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

	if (AActor* SpawnedActor = GetWorld()->SpawnActor<AActor>(TemplateClass, FTransform(SectorDefinition.WorldLocation), SpawnParams))
	{
		SpawnedSectorActors.Add(SpawnedActor);
	}
}
